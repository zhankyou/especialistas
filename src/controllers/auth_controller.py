import jwt
import datetime
from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from config.settings import Config
from src.models.especialista_model import Especialista

auth_bp = Blueprint('auth_bp', __name__)


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """
    Controlador de Autenticación Central (IAM).
    Valida credenciales, verifica bloqueos y emite un JWT firmado.
    Incluye telemetría interna (Auditoría) para trazabilidad de errores 401.
    """
    try:
        data = request.get_json()
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({"status": "error", "message": "Cuerpo de solicitud inválido."}), 400

        email = data.get('email').strip()
        password = data.get('password')

        user = Especialista.query.filter_by(email=email).first()

        # Auditoría Backend (No expuesto al cliente por normativas OWASP)
        if not user:
            print(f"[AUTH AUDIT] Intento fallido: El correo '{email}' no existe en la base de datos.")
            return jsonify({"status": "error", "message": "Credenciales inválidas o correo no registrado."}), 401

        if not check_password_hash(user.password_hash, password):
            print(f"[AUTH AUDIT] Intento fallido: Contraseña incorrecta para el usuario '{email}'.")
            return jsonify({"status": "error", "message": "Credenciales inválidas o correo no registrado."}), 401

        # Prevención de acceso a cuentas bloqueadas lógicamente
        if user.is_blocked:
            print(f"[AUTH AUDIT] Intento fallido: El usuario '{email}' se encuentra bloqueado.")
            return jsonify({"status": "error", "message": "Su cuenta ha sido bloqueada. Contacte a Coordinación."}), 403

        # Generación Criptográfica del Token JWT con claims extendidos
        token = jwt.encode({
            'user_id': user.id,
            'email': user.email,
            'rol': user.rol,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        }, Config.JWT_SECRET_KEY, algorithm='HS256')

        print(f"[AUTH AUDIT] Acceso concedido exitosamente a '{email}' (Rol: {user.rol}).")

        return jsonify({
            "status": "success",
            "token": token,
            "email": user.email,
            "rol": user.rol
        }), 200

    except Exception as e:
        print(f"Error Crítico Auth: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo interno en el servidor de autenticación."}), 500