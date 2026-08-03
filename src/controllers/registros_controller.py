from flask import Blueprint, request, jsonify, render_template, Response
import datetime
from src.services.registros_service import RegistrosService
from src.services.telegram_service import TelegramService
from src.utils.auth_utils import get_user_from_request

registros_bp = Blueprint('registros_bp', __name__)


@registros_bp.route('/registros')
def view_registros():
    """Renderiza la vista principal del gestor de expedientes."""
    return render_template('registros.html')


@registros_bp.route('/api/registros/list', methods=['GET'])
def list_registros():
    """
    Lista expedientes unificados aplicando control de acceso basado en roles (RLAC).
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "No autorizado."}), 401

    is_deleted = request.args.get('deleted', 'false').lower() == 'true'
    search = request.args.get('search', '').strip()

    result = RegistrosService.get_registros(
        is_deleted=is_deleted,
        search_term=search,
        user_email=user_data.get('email'),
        user_role=user_data.get('rol')
    )
    return jsonify(result), result['code']


@registros_bp.route('/api/registros/toggle', methods=['POST'])
def toggle_registro():
    """
    Modifica el estado de borrado lógico (Soft Delete) de un expediente.
    Restringe el permiso de restauración a perfiles no administrativos.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "No autorizado."}), 401

    data = request.get_json()
    if not data or 'id' not in data or 'modulo' not in data or 'delete' not in data:
        return jsonify({"status": "error", "message": "Payload invalido."}), 400

    # Regla de Negocio: DILIGENCIADOR no puede restaurar registros (delete == False)
    if data['delete'] == False and user_data.get('rol') == 'DILIGENCIADOR':
        return jsonify({
            "status": "error",
            "message": "Su rol no posee permisos para restaurar expedientes. Contacte a Coordinacion."
        }), 403

    result = RegistrosService.toggle_soft_delete(
        record_id=data['id'],
        modulo=data['modulo'],
        is_deleted_flag=data['delete'],
        user_email=user_data.get('email'),
        user_role=user_data.get('rol')
    )
    return jsonify(result), result['code']


@registros_bp.route('/api/registros/request_restore', methods=['POST'])
def request_restore():
    """
    Envía una notificación vía Webhook a Telegram solicitando la restauración de un registro.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "No autorizado."}), 401

    data = request.get_json()
    record_id = data.get('id') if data else None
    if not record_id:
        return jsonify({"status": "error", "message": "ID de expediente requerido."}), 400

    success = TelegramService.send_restoration_request(
        record_id=record_id,
        user_email=user_data.get('email'),
        user_role=user_data.get('rol')
    )

    if success:
        return jsonify({
            "status": "success",
            "message": "Solicitud enviada a la linea administrativa (Telegram).",
            "code": 200
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "Fallo de comunicacion con la API de Telegram.",
            "code": 500
        }), 500


@registros_bp.route('/api/registros/detalle/<modulo>/<record_id>', methods=['GET'])
def detalle_registro(modulo, record_id):
    """
    Obtiene los detalles estructurados de un expediente garantizando que el DILIGENCIADOR solo acceda a los suyos.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "No autorizado."}), 401

    result = RegistrosService.get_registro_detalle(
        record_id=record_id,
        modulo=modulo,
        user_email=user_data.get('email'),
        user_role=user_data.get('rol')
    )
    return jsonify(result), result['code']


@registros_bp.route('/api/registros/export', methods=['GET'])
def export_registros_csv():
    """
    Genera y sirve una exportación masiva en CSV filtrada dinámicamente y limitada según el rol.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "No autorizado."}), 401

    filtro_tipo = request.args.get('filtro', 'todo')
    param1 = request.args.get('p1', '')
    param2 = request.args.get('p2', '')

    res = RegistrosService.exportar_expedientes_csv(
        filtro_tipo=filtro_tipo,
        param1=param1,
        param2=param2,
        user_email=user_data.get('email'),
        user_role=user_data.get('rol')
    )

    if res['status'] == 'error':
        return jsonify(res), res['code']

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"APS_Exportacion_Datos_{timestamp}.csv"

    return Response(
        res['csv_data'],
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )