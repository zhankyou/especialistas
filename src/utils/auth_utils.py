import jwt
from functools import wraps
from flask import request, jsonify
from config.settings import Config


def get_user_from_request(req):
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    try:
        token = auth_header.split(" ")[1]
        return jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
    except:
        return None


def require_roles(*allowed_roles):
    """
    Decorador de Arquitectura RBAC.
    Verifica que el Claim 'rol' dentro del JWT coincida con los parámetros permitidos.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_data = get_user_from_request(request)
            if not user_data:
                return jsonify(
                    {"status": "error", "message": "Autenticación requerida. Token faltante o inválido."}), 401

            if user_data.get('rol') not in allowed_roles:
                return jsonify({"status": "error",
                                "message": f"Acceso denegado (HTTP 403). Rol requerido: {', '.join(allowed_roles)}."}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator