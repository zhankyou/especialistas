from flask import Blueprint, request, jsonify, render_template
from src.services.usuarios_service import UsuariosService
from src.utils.auth_utils import require_roles, get_user_from_request

usuarios_bp = Blueprint('usuarios_bp', __name__)


@usuarios_bp.route('/usuarios')
def view_usuarios():
    """Renderiza el Frontend SPA del IAM."""
    return render_template('usuarios.html')


@usuarios_bp.route('/api/usuarios/list', methods=['GET'])
@require_roles('ADMINISTRADOR', 'COORDINADOR')
def list_usuarios():
    result = UsuariosService.get_all_users()
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/create', methods=['POST'])
@require_roles('ADMINISTRADOR')
def create_usuario():
    data = request.get_json()
    result = UsuariosService.create_user(data)
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/toggle_block', methods=['POST'])
@require_roles('ADMINISTRADOR', 'COORDINADOR')
def toggle_block():
    user_data = get_user_from_request(request)
    data = request.get_json()

    # REGLA DE NEGOCIO ESTRICTA: Coordinador solo puede Desbloquear (False)
    if user_data['rol'] == 'COORDINADOR' and data.get('is_blocked') == True:
        return jsonify({"status": "error",
                        "message": "Violación de privilegios: Coordinador solo puede desbloquear usuarios."}), 403

    result = UsuariosService.toggle_block(data.get('user_id'), data.get('is_blocked'))
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/delete', methods=['DELETE'])
@require_roles('ADMINISTRADOR')
def delete_usuario():
    data = request.get_json()
    result = UsuariosService.delete_user(data.get('user_id'))
    return jsonify(result), result['code']


@usuarios_bp.route('/api/usuarios/reset_password', methods=['POST'])
@require_roles('ADMINISTRADOR')
def reset_password():
    data = request.get_json()
    result = UsuariosService.reset_password(data.get('user_id'), data.get('new_password'))
    return jsonify(result), result['code']