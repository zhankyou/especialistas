import uuid
from flask import Blueprint, request, jsonify, make_response, render_template
from src.services.respiratoria_service import RespiratoriaService
from src.services.pdf_service import PdfService
from src.utils.auth_utils import get_user_from_request
from src.utils.image_utils import ImageUtils
from src.utils.dto_utils import SmartDTO

respiratoria_bp = Blueprint('respiratoria_bp', __name__)


@respiratoria_bp.route('/respiratoria', methods=['GET'], strict_slashes=False)
def view_respiratoria():
    return render_template('respiratoria.html')


@respiratoria_bp.route('/api/respiratoria/save', methods=['POST'], strict_slashes=False)
def save_respiratoria():
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON vacio."}), 400

    result = RespiratoriaService.save_form(payload, user_data)
    return jsonify(result), result.get('code', 200)


@respiratoria_bp.route('/api/respiratoria/<form_id>', methods=['GET'], strict_slashes=False)
def get_respiratoria_detail(form_id):
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    try:
        val_uuid = str(uuid.UUID(form_id))
    except ValueError:
        return jsonify({"status": "error", "message": "UUID invalido."}), 400

    result = RespiratoriaService.get_by_id(val_uuid, user_data)
    return jsonify(result), result.get('code', 200)


@respiratoria_bp.route('/api/respiratoria/<form_id>/pdf', methods=['GET'], strict_slashes=False)
def download_pdf(form_id):
    from src.models import db
    from src.models.respiratoria_model import FormularioRespiratoria

    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    try:
        val_uuid = str(uuid.UUID(form_id))
    except ValueError:
        return jsonify({"status": "error", "message": "UUID invalido."}), 400

    formulario = db.session.get(FormularioRespiratoria, val_uuid)
    if not formulario or formulario.is_deleted:
        return jsonify({"status": "error", "message": "Formulario no encontrado."}), 404

    data_dto = SmartDTO(formulario.to_dict())
    data_dto.logo_aps = ImageUtils.get_base64_image('logo-aps.png')
    data_dto.logo_ese = ImageUtils.get_base64_image('logo-ese.png')

    try:
        pdf_bytes = PdfService.generate_respiratoria_pdf(data_dto)
        if not pdf_bytes:
            raise ValueError("Motor de renderizado devolvio flujo vacio.")

        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        codigo_fam = data_dto.get('codigo_familia', 'Desconocido')
        response.headers['Content-Disposition'] = f'attachment; filename="APS_Respiratoria_{codigo_fam}_{val_uuid[:8]}.pdf"'
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'

        return response
    except Exception as e:
        print(f"[PDF ERROR] Fallo PDF Respiratoria: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo interno PDF."}), 500
