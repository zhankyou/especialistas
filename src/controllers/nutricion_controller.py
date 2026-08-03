import os
import base64
import json
from datetime import datetime, date
from flask import Blueprint, request, jsonify, make_response, render_template, current_app
from src.services.nutricion_service import NutricionService
from src.services.pdf_service import PdfService
from src.models.nutricion_model import FormularioNutricion
from src.models import db
from src.utils.auth_utils import get_user_from_request
from src.controllers.fisioterapia_controller import build_dto, get_base64_image

nutricion_bp = Blueprint('nutricion_bp', __name__)

@nutricion_bp.route('/nutricion')
def view_nutricion():
    return render_template('nutricion.html')

@nutricion_bp.route('/api/nutricion/save', methods=['POST'])
def save_nutricion():
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Payload JSON vacio o invalido."}), 400

    user_email = user_data.get('email')
    result = NutricionService.save_registro(data, user_email)
    return jsonify(result), result['code']

@nutricion_bp.route('/api/nutricion/<form_id>/pdf', methods=['GET'])
def download_pdf(form_id):
    formulario = db.session.get(FormularioNutricion, form_id)
    if not formulario:
        return jsonify({"status": "error", "message": "Formulario no encontrado."}), 404

    data_dict = build_dto(formulario)
    data_dict['logo_aps'] = get_base64_image('logo-aps.png')
    data_dict['logo_ese'] = get_base64_image('logo-ese.png')

    try:
        pdf_bytes = PdfService.generate_nutricion_pdf(data_dict)
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        codigo_familia = getattr(formulario, 'codigo_familia', getattr(formulario, 'no_familia', 'Desconocido'))
        response.headers['Content-Disposition'] = f'attachment; filename="APS_Nutricion_{codigo_familia}.pdf"'
        return response
    except Exception as e:
        print(f"Error Interno en generador PDF (Nutricion): {str(e)}")
        return jsonify({"status": "error", "message": "Fallo en motor de renderizado PDF."}), 500