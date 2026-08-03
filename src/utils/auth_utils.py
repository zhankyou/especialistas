import jwt
from functools import wraps
from flask import request, jsonify
from config.settings import Config


def get_user_from_request(req):
    auth_header = req.headers.get('Authorization')
    if not auth_header:
        return None

    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except Exception as e:
        print(f"[IAM ERROR] Fallo de decodificacion JWT: {str(e)}")
        return None


def require_roles(*allowed_roles):
    """
    Decorador RBAC (Role-Based Access Control).
    Intercepta la peticion HTTP y valida criptograficamente la identidad y privilegios.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_data = get_user_from_request(request)
            if not user_data:
                return jsonify({
                    "status": "error",
                    "message": "Autenticacion requerida. Firma JWT ausente o expirada."
                }), 401

            user_role = user_data.get('rol', '').upper()
            allowed_roles_upper = [r.upper() for r in allowed_roles]

            if user_role not in allowed_roles_upper:
                print(
                    f"[SECURITY BREACH] Intento de escalada de privilegios bloqueado. Usuario: {user_data.get('email')} - Rol actual: {user_role}")
                return jsonify({
                    "status": "error",
                    "message": "Acceso denegado. Privilegios insuficientes (RBAC)."
                }), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator