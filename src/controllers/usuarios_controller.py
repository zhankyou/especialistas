from flask import Blueprint, request, jsonify
from src.services.usuarios_service import UsuariosService
from src.utils.auth_utils import get_user_from_request

usuarios_bp = Blueprint('usuarios_bp', __name__)


@usuarios_bp.route('/api/usuarios/list', methods=['GET'], strict_slashes=False)
def list_usuarios():
    """Extrae el listado completo de usuarios registrados para el panel administrativo."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    user_role = str(user_data.get('rol', '')).strip().upper()
    if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
        return jsonify({"status": "error", "message": "Acceso denegado. Privilegios insuficientes."}), 403

    result = UsuariosService.get_all_users()
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/diligenciadores', methods=['GET'], strict_slashes=False)
def get_diligenciadores():
    """
    Endpoint RESTful para obtener la lista de especialistas con rol DILIGENCIADOR.
    Resuelve el error HTTP 404 al abrir el formulario de nutricion.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    result = UsuariosService.get_diligenciadores()
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/create', methods=['POST'], strict_slashes=False)
def create_usuario():
    """Registra un nuevo usuario en la plataforma IAM."""
    user_data = get_user_from_request(request)
    if not user_data or str(user_data.get('rol', '')).upper() != 'ADMINISTRADOR':
        return jsonify({"status": "error", "message": "Solo administradores pueden crear usuarios."}), 403

    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Payload JSON invalido o vacio."}), 400

    result = UsuariosService.create_user(data)
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/toggle_block', methods=['POST'], strict_slashes=False)
def toggle_block():
    """Alterna el estado de bloqueo de un usuario."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    data = request.get_json() or {}
    is_blocked_requested = data.get('is_blocked')

    if str(user_data.get('rol', '')).upper() == 'COORDINADOR' and is_blocked_requested is True:
        print(f"[SECURITY AUDIT] Intento de bloqueo rechazado para Coordinador: {user_data.get('email')}")
        return jsonify({
            "status": "error",
            "message": "Violacion de privilegios: Un Coordinador solo puede desbloquear usuarios."
        }), 403

    result = UsuariosService.toggle_block(data.get('user_id'), is_blocked_requested)
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/delete', methods=['DELETE'], strict_slashes=False)
def delete_usuario():
    """Elimina permanentemente un usuario de la base de datos."""
    user_data = get_user_from_request(request)
    if not user_data or str(user_data.get('rol', '')).upper() != 'ADMINISTRADOR':
        return jsonify({"status": "error", "message": "Acceso restringido a Administradores."}), 403

    data = request.get_json() or {}
    if not data.get('user_id'):
        return jsonify({"status": "error", "message": "Falta el ID del usuario."}), 400

    result = UsuariosService.delete_user(data.get('user_id'))
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/reset_password', methods=['POST'], strict_slashes=False)
def reset_password():
    """Restablece la contrasena de un usuario."""
    user_data = get_user_from_request(request)
    if not user_data or str(user_data.get('rol', '')).upper() != 'ADMINISTRADOR':
        return jsonify({"status": "error", "message": "Acceso restringido a Administradores."}), 403

    data = request.get_json() or {}
    if not data.get('user_id') or not data.get('new_password'):
        return jsonify({"status": "error", "message": "Parametros incompletos."}), 400

    result = UsuariosService.reset_password(data.get('user_id'), data.get('new_password'))
    return jsonify(result), result['code']
