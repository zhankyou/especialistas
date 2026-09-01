from flask import Blueprint, request, jsonify, Response, make_response
from src.services.registros_service import RegistrosService
from src.services.telegram_service import TelegramService
from src.utils.auth_utils import get_user_from_request

registros_bp = Blueprint('registros_bp', __name__)


@registros_bp.route('/api/registros/list', methods=['GET'])
def list_registros():
    """
    Endpoint RESTful para el listado consolidado de expedientes clinicos.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    is_deleted = request.args.get('deleted', 'false').strip().lower() == 'true'
    search_query = request.args.get('search', '').strip()

    result = RegistrosService.get_all_records(user_data, is_deleted=is_deleted, search_query=search_query)
    return jsonify(result), result['code']


@registros_bp.route('/api/registros/detalle/<modulo>/<record_id>', methods=['GET'])
def get_detalle_registro(modulo, record_id):
    """
    Endpoint RESTful para extraer la totalidad de campos de un formulario y permitir su visualizacion completa.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    result = RegistrosService.get_record_detail(modulo, record_id, user_data)
    return jsonify(result), result['code']


@registros_bp.route('/api/registros/delete/<record_id>', methods=['DELETE'])
def delete_registro(record_id):
    """Aplica borrado logico (Soft Delete) en el repositorio multinivel."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    result = RegistrosService.soft_delete_record(record_id, user_data)
    return jsonify(result), result['code']


@registros_bp.route('/api/registros/restore/<record_id>', methods=['POST'])
def restore_registro(record_id):
    """Restaura un expediente previamente archivado en la papelera."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    result = RegistrosService.restore_record(record_id, user_data)
    return jsonify(result), result['code']


@registros_bp.route('/api/registros/request_restore', methods=['POST'])
def request_restore():
    """Despacha notificacion push a Telegram para autorizar restauracion."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    payload = request.get_json() or {}
    record_id = payload.get('record_id') or payload.get('id')

    if not record_id:
        return jsonify({"status": "error", "message": "Identificador de expediente ausente."}), 400

    try:
        TelegramService.send_restoration_request(
            record_id=record_id,
            user_email=user_data.get('email'),
            user_role=user_data.get('rol')
        )
        return jsonify({"status": "success", "message": "Solicitud de restauracion despachada a Coordinacion."}), 200
    except Exception as e:
        print(f"[CONTROLLER ERROR] Fallo al invocar webhook de Telegram: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo al despachar la alerta push."}), 500


@registros_bp.route('/api/registros/export', methods=['GET'])
def export_registros():
    """Genera y transmite dinamicamente Streams CSV o ZIP en base al esquema DDL de la DB."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    filter_type = request.args.get('filtro', 'todo').strip().lower()
    p1 = request.args.get('p1', '').strip()
    p2 = request.args.get('p2', '').strip()

    file_bytes, filename, mimetype = RegistrosService.export_csv(user_data, filter_type, p1, p2)

    if file_bytes is None:
        return jsonify({"status": "warning", "message": filename}), 404

    response = make_response(file_bytes)
    response.headers['Content-Type'] = mimetype
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response
