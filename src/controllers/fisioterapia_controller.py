import uuid
from flask import Blueprint, request, jsonify, make_response, render_template
from src.services.fisioterapia_service import FisioterapiaService
from src.services.pdf_service import PdfService
from src.utils.auth_utils import get_user_from_request
from src.utils.image_utils import ImageUtils
from src.utils.dto_utils import SmartDTO

fisioterapia_bp = Blueprint('fisioterapia_bp', __name__)


@fisioterapia_bp.route('/fisioterapia', methods=['GET'], strict_slashes=False)
def view_fisioterapia():
    return render_template('fisioterapia.html')


@fisioterapia_bp.route('/api/fisioterapia/save', methods=['POST'], strict_slashes=False)
def save_fisioterapia():
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON vacio."}), 400

    result = FisioterapiaService.save_form(payload, user_data)
    return jsonify(result), result.get('code', 200)


@fisioterapia_bp.route('/api/fisioterapia/<form_id>', methods=['GET'], strict_slashes=False)
def get_fisioterapia_detail(form_id):
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    try:
        val_uuid = str(uuid.UUID(form_id))
    except ValueError:
        return jsonify({"status": "error", "message": "UUID invalido."}), 400

    result = FisioterapiaService.get_by_id(val_uuid, user_data)
    return jsonify(result), result.get('code', 200)


@fisioterapia_bp.route('/api/fisioterapia/<form_id>/pdf', methods=['GET'], strict_slashes=False)
def download_pdf(form_id):
    """
    Genera el reporte binario PDF encapsulando los datos con SmartDTO Callable
    para garantizar tolerancia total a atributos ausentes o llamadas a metodos no definidos.
    """
    from src.models import db
    from src.models.fisioterapia_model import FormularioFisioterapia

    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    try:
        val_uuid = str(uuid.UUID(form_id))
    except ValueError:
        return jsonify({"status": "error", "message": "Identificador UUID invalido."}), 400

    formulario = db.session.get(FormularioFisioterapia, val_uuid)
    if not formulario or formulario.is_deleted:
        return jsonify({"status": "error", "message": "Formulario de Fisioterapia no encontrado."}), 404

    # Envoltura dinamica resiliente ante invocaciones de metodos
    raw_dict = formulario.to_dict()
    data_dto = SmartDTO(raw_dict)

    # Inyeccion de activos graficos corporativos
    data_dto.logo_aps = ImageUtils.get_base64_image('logo-aps.png')
    data_dto.logo_ese = ImageUtils.get_base64_image('logo-ese.png')

    try:
        pdf_bytes = PdfService.generate_fisioterapia_pdf(data_dto)
        if not pdf_bytes:
            raise ValueError("El motor PDF genero un flujo de bytes vacio.")

        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        codigo_fam = data_dto.get('codigo_familia', 'Desconocido')
        filename = f"APS_Fisioterapia_{codigo_fam}_{val_uuid[:8]}.pdf"

        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'

        return response

    except Exception as e:
        print(f"[PDF ERROR] Fallo critico al generar PDF Fisioterapia para ID {val_uuid}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error interno en motor de renderizado PDF: {str(e)}"
        }), 500
