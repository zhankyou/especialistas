from flask import Blueprint, request, jsonify
from src.utils.auth_utils import get_user_from_request
from src.services.fisioterapia_service import FisioterapiaService
from src.services.nutricion_service import NutricionService
from src.services.respiratoria_service import RespiratoriaService

sync_bp = Blueprint('sync_bp', __name__)


@sync_bp.route('/api/sync/batch', methods=['POST'], strict_slashes=False)
def sync_batch():
    """
    Endpoint RESTful de Procesamiento por Lotes (Batch Processing).
    Recibe la cola de expedientes almacenada en el LocalStorage de dispositivos
    fuera de linea y delega transaccionalmente a la capa de dominio especifica.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    payload = request.get_json()
    if not payload or not isinstance(payload, list):
        return jsonify({"status": "error", "message": "Estructura de sincronizacion invalida."}), 400

    synced_ids = []
    errors = []

    for item in payload:
        modulo = str(item.get('modulo', '')).lower()
        data = item.get('payload', {})
        local_id = data.get('local_id', '')

        try:
            if modulo == 'fisioterapia':
                res = FisioterapiaService.save_form(data, user_data)
            elif modulo == 'nutricion':
                res = NutricionService.save_form(data, user_data)
            elif modulo == 'respiratoria':
                res = RespiratoriaService.save_form(data, user_data)
            else:
                errors.append({"local_id": local_id, "error": "Modulo de especialidad desconocido."})
                continue

            if res.get('status') == 'success':
                synced_ids.append(local_id)
            else:
                errors.append({"local_id": local_id, "error": res.get('message', 'Fallo logico de insercion.')})

        except Exception as e:
            print(f"[SYNC BATCH ERROR] Falla en transaccion offline para {local_id}: {str(e)}")
            errors.append({"local_id": local_id, "error": "Error interno del servidor durante Commit."})

    status_msg = "success" if not errors else "partial"

    return jsonify({
        "status": status_msg,
        "synced_ids": synced_ids,
        "errors": errors
    }), 200
