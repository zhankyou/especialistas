import os
import base64
import json
from datetime import datetime, date
from flask import Blueprint, request, jsonify, make_response, render_template, current_app
from src.services.respiratoria_service import RespiratoriaService
from src.services.pdf_service import PdfService
from src.models.respiratoria_model import FormularioRespiratoria
from src.models import db
from src.utils.auth_utils import get_user_from_request
from src.controllers.fisioterapia_controller import build_dto, get_base64_image

respiratoria_bp = Blueprint('respiratoria_bp', __name__)

@respiratoria_bp.route('/respiratoria')
def view_respiratoria():
    return render_template('respiratoria.html')

@respiratoria_bp.route('/api/respiratoria/save', methods=['POST'])
def save_respiratoria():
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Payload JSON vacio o invalido."}), 400

    user_email = user_data.get('email')
    result = RespiratoriaService.save_registro(data, user_email)
    return jsonify(result), result['code']

@respiratoria_bp.route('/api/respiratoria/<form_id>/pdf', methods=['GET'])
def download_pdf(form_id):
    formulario = db.session.get(FormularioRespiratoria, form_id)
    if not formulario:
        return jsonify({"status": "error", "message": "Formulario no encontrado."}), 404

    data_dict = build_dto(formulario)
    data_dict['logo_aps'] = get_base64_image('logo-aps.png')
    data_dict['logo_ese'] = get_base64_image('logo-ese.png')

    try:
        pdf_bytes = PdfService.generate_respiratoria_pdf(data_dict)
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        codigo_familia = getattr(formulario, 'codigo_familia', getattr(formulario, 'no_familia', 'Desconocido'))
        response.headers['Content-Disposition'] = f'attachment; filename="APS_Terapia_Respiratoria_{codigo_familia}.pdf"'
        return response
    except Exception as e:
        print(f"Error Interno en generador PDF (Respiratoria): {str(e)}")
        return jsonify({"status": "error", "message": "Fallo en motor de renderizado PDF."}), 500