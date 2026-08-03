from flask import Blueprint, request, jsonify
from src.services.usuarios_service import UsuariosService
from src.utils.auth_utils import require_roles, get_user_from_request

# Blueprint dedicado estrictamente a transacciones API (JSON)
usuarios_bp = Blueprint('usuarios_bp', __name__)


@usuarios_bp.route('/api/usuarios/list', methods=['GET'])
@require_roles('ADMINISTRADOR', 'COORDINADOR')
def list_usuarios():
    """Extrae el listado completo de usuarios de PostgreSQL Aiven."""
    result = UsuariosService.get_all_users()
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/create', methods=['POST'])
@require_roles('ADMINISTRADOR')
def create_usuario():
    """Registra un nuevo usuario y despacha credenciales via SMTP Async."""
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Payload JSON invalido o vacio."}), 400

    result = UsuariosService.create_user(data)
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/toggle_block', methods=['POST'])
@require_roles('ADMINISTRADOR', 'COORDINADOR')
def toggle_block():
    """Alterna el estado de acceso de un usuario. Aplica reglas de negocio RBAC."""
    user_data = get_user_from_request(request)
    data = request.get_json()

    is_blocked_requested = data.get('is_blocked')

    # REGLA DE NEGOCIO ESTRICTA: Coordinador solo puede Desbloquear (False)
    if user_data.get('rol', '').upper() == 'COORDINADOR' and is_blocked_requested is True:
        print(f"[SECURITY AUDIT] Intento de bloqueo rechazado para Coordinador: {user_data.get('email')}")
        return jsonify({
            "status": "error",
            "message": "Violacion de privilegios: Un Coordinador solo puede desbloquear usuarios."
        }), 403

    result = UsuariosService.toggle_block(data.get('user_id'), is_blocked_requested)
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/delete', methods=['DELETE'])
@require_roles('ADMINISTRADOR')
def delete_usuario():
    """Elimina permanentemente un usuario de la base de datos (Hard Delete)."""
    data = request.get_json()
    if not data or not data.get('user_id'):
        return jsonify({"status": "error", "message": "Falta el ID del usuario."}), 400

    result = UsuariosService.delete_user(data.get('user_id'))
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/reset_password', methods=['POST'])
@require_roles('ADMINISTRADOR')
def reset_password():
    """Sobrescribe la contrasena de un usuario con un nuevo hash criptografico."""
    data = request.get_json()
    if not data or not data.get('user_id') or not data.get('new_password'):
        return jsonify({"status": "error", "message": "Parametros incompletos."}), 400

    result = UsuariosService.reset_password(data.get('user_id'), data.get('new_password'))
    return jsonify(result), result['code']