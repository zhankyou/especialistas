import datetime
import jwt
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func
from config.settings import Config
from src.models import db
from src.models.especialista_model import Especialista
from src.services.email_service import EmailService
from src.utils.security_utils import SecurityUtils
from src.utils.auth_utils import get_user_from_request

auth_bp = Blueprint('auth_bp', __name__)


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON vacio."}), 400

    raw_email = payload.get('email', '')
    password = payload.get('password', '')

    clean_email = SecurityUtils.sanitize_email_login(raw_email)

    if not clean_email or not password:
        return jsonify({"status": "error", "message": "Credenciales incompletas."}), 400

    user = db.session.query(Especialista).filter(
        func.lower(func.trim(Especialista.email)) == func.lower(func.trim(clean_email))
    ).first()

    if not user:
        print(f"[IAM AUDIT] Usuario '{clean_email}' no encontrado en PostgreSQL.")
        return jsonify({"status": "error", "message": "Credenciales invalidas o cuenta inactiva."}), 401

    is_user_active = getattr(user, 'is_active', True)
    if is_user_active is False:
        return jsonify({"status": "error", "message": "Credenciales invalidas o cuenta inactiva."}), 401

    if hasattr(user, 'is_locked') and user.is_locked():
        return jsonify({"status": "error", "message": "Cuenta bloqueada temporalmente. Intente mas tarde."}), 423

    if not user.verify_password(password):
        if hasattr(user, 'failed_login_attempts'):
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                if hasattr(user, 'account_locked_until'):
                    user.account_locked_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
                print(f"[SECURITY] Cuenta {clean_email} bloqueada por intentos fallidos.")

            db.session.commit()

        return jsonify({"status": "error", "message": "Credenciales invalidas."}), 401

    if hasattr(user, 'failed_login_attempts'):
        user.failed_login_attempts = 0
    if hasattr(user, 'account_locked_until'):
        user.account_locked_until = None
    if hasattr(user, 'last_login_at'):
        user.last_login_at = datetime.datetime.utcnow()

    db.session.commit()

    token_payload = {
        'sub': user.id,
        'email': user.email,
        'rol': getattr(user, 'rol', 'profesional_aps'),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12),
        'iat': datetime.datetime.utcnow()
    }

    token = jwt.encode(token_payload, Config.JWT_SECRET_KEY, algorithm='HS256')

    print(f"[IAM SUCCESS] Autenticacion exitosa para: {clean_email}")

    return jsonify({
        "status": "success",
        "message": "Autenticacion exitosa.",
        "data": {
            "token": token,
            "email": user.email,
            "rol": getattr(user, 'rol', 'profesional_aps')
        }
    }), 200


@auth_bp.route('/api/auth/register', methods=['POST'])
def register_especialista():
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    requester_role = user_data.get('rol', '')
    if requester_role not in ['ADMINISTRADOR', 'COORDINADOR']:
        return jsonify({"status": "error", "message": "Privilegios insuficientes."}), 403

    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON vacio."}), 400

    raw_email = payload.get('email')
    target_role = payload.get('rol', 'profesional_aps')

    clean_email = SecurityUtils.sanitize_email_strict(raw_email)
    if not clean_email:
        return jsonify({"status": "error", "message": "Correo electronico invalido."}), 400

    existing_user = db.session.query(Especialista).filter(
        func.lower(func.trim(Especialista.email)) == func.lower(func.trim(clean_email))
    ).first()

    if existing_user:
        return jsonify({"status": "error", "message": "El especialista ya esta registrado."}), 409

    generated_password = payload.get('password') or SecurityUtils.generate_secure_password(12)

    try:
        nuevo_especialista = Especialista(
            email=clean_email,
            password=generated_password,
            rol=target_role
        )

        db.session.add(nuevo_especialista)
        db.session.commit()

        app_obj = current_app._get_current_object()
        EmailService.send_welcome_credentials_async(app_obj, clean_email, generated_password, target_role)

        return jsonify({
            "status": "success",
            "message": "Especialista registrado correctamente.",
            "data": {
                "id": nuevo_especialista.id,
                "email": nuevo_especialista.email,
                "rol": nuevo_especialista.rol
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"[DATABASE ERROR] Fallo al registrar especialista: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo interno al procesar el registro."}), 500