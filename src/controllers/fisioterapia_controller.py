import os
import base64
import json
from datetime import datetime, date
from flask import Blueprint, request, jsonify, make_response, render_template, current_app
from src.services.fisioterapia_service import FisioterapiaService
from src.services.pdf_service import PdfService
from src.models.fisioterapia_model import FormularioFisioterapia
from src.models import db
from src.utils.auth_utils import get_user_from_request

fisioterapia_bp = Blueprint('fisioterapia_bp', __name__)

def get_base64_image(image_filename):
    try:
        img_path = os.path.join(current_app.root_path, 'static', 'img', image_filename)
        with open(img_path, 'rb') as img_file:
            encoded_string = base64.b64encode(img_file.read()).decode('utf-8')
            return f"data:image/png;base64,{encoded_string}"
    except Exception as e:
        print(f"ADVERTENCIA: No se pudo cargar la imagen {image_filename}. Detalle: {e}")
        return ""

def _clean_value(value):
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime('%Y-%m-%d')
    if isinstance(value, str):
        val_str = value.strip()
        if (val_str.startswith('{') and val_str.endswith('}')) or (val_str.startswith('[') and val_str.endswith(']')):
            try:
                parsed = json.loads(val_str)
                return _clean_value(parsed)
            except Exception:
                return value
        return value
    if isinstance(value, dict):
        return {k: _clean_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean_value(v) for v in value]
    return value

def build_dto(model_instance):
    data_dict = {}
    for col in model_instance.__table__.columns:
        raw_val = getattr(model_instance, col.name)
        data_dict[col.name] = _clean_value(raw_val)
    return data_dict

@fisioterapia_bp.route('/fisioterapia')
def view_fisio():
    return render_template('fisioterapia.html')

@fisioterapia_bp.route('/api/fisioterapia/save', methods=['POST'])
def save_fisio():
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Payload JSON vacio o invalido."}), 400

    user_email = user_data.get('email')
    result = FisioterapiaService.save_registro(data, user_email)
    return jsonify(result), result['code']

@fisioterapia_bp.route('/api/fisioterapia/<form_id>/pdf', methods=['GET'])
def download_pdf(form_id):
    form = db.session.get(FormularioFisioterapia, form_id)
    if not form:
        return jsonify({"status": "error", "message": "Formulario no encontrado."}), 404

    data_dict = build_dto(form)
    data_dict['logo_aps'] = get_base64_image('logo-aps.png')
    data_dict['logo_ese'] = get_base64_image('logo-ese.png')

    try:
        pdf_bytes = PdfService.generate_fisioterapia_pdf(data_dict)
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        codigo_familia = getattr(form, 'codigo_familia', getattr(form, 'no_familia', 'Desconocido'))
        response.headers['Content-Disposition'] = f'attachment; filename="APS_Fisioterapia_{codigo_familia}.pdf"'
        return response
    except Exception as e:
        print(f"Error Interno en generador PDF (Fisioterapia): {str(e)}")
        return jsonify({"status": "error", "message": "Fallo en motor de renderizado PDF."}), 500