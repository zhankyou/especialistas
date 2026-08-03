import datetime
import jwt
from flask import Blueprint, request, jsonify
from config.settings import Config
from src.models import db
from src.models.especialista_model import Especialista
from src.services.email_service import EmailService
from src.utils.security_utils import SecurityUtils
from src.utils.auth_utils import get_user_from_request

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """
    Endpoint de Autenticacion (Inicio de Sesion).
    Implementa mitigacion OWASP contra ataques de Fuerza Bruta y Credential Stuffing.
    """
    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON nulo o malformado."}), 400

    raw_email = payload.get('email', '')
    password = payload.get('password', '')
    
    clean_email = SecurityUtils.sanitize_email(raw_email)

    if not clean_email or not password:
        return jsonify({"status": "error", "message": "Credenciales incompletas o formato invalido."}), 400

    # 1. Busqueda del usuario en la base de datos
    user = db.session.query(Especialista).filter_by(email=clean_email).first()

    # Mitigacion de enumeracion de usuarios: Mensaje de error generico
    if not user or not user.is_active:
        return jsonify({"status": "error", "message": "Credenciales invalidas o cuenta inactiva."}), 401

    # 2. Verificacion de Bloqueo Temporal (Anti-Brute Force)
    if user.is_locked():
        return jsonify({"status": "error", "message": "Cuenta bloqueada temporalmente por multiples intentos fallidos. Intente mas tarde."}), 423

    # 3. Verificacion Criptografica de la Contraseña
    if not user.verify_password(password):
        user.failed_login_attempts += 1
        # Politica estricta: Bloqueo de 15 minutos tras 5 intentos fallidos
        if user.failed_login_attempts >= 5:
            user.account_locked_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
            print(f"SECURITY ALERT: Cuenta {clean_email} bloqueada por intentos fallidos recurrentes.")
        
        db.session.commit()
        return jsonify({"status": "error", "message": "Credenciales invalidas."}), 401

    # 4. Exito en la autenticacion: Limpieza de estado de riesgo
    user.failed_login_attempts = 0
    user.account_locked_until = None
    user.last_login_at = datetime.datetime.utcnow()
    db.session.commit()

    # 5. Generacion de Token JWT Segregado
    token_payload = {
        'sub': user.id,
        'email': user.email,
        'rol': user.rol,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12),
        'iat': datetime.datetime.utcnow()
    }
    
    token = jwt.encode(token_payload, Config.JWT_SECRET_KEY, algorithm='HS256')

    print(f"INFO IAM: Autenticacion exitosa para usuario {clean_email}.")

    return jsonify({
        "status": "success",
        "message": "Autenticacion exitosa.",
        "data": {
            "token": token,
            "email": user.email,
            "rol": user.rol
        }
    }), 200


@auth_bp.route('/api/auth/register', methods=['POST'])
def register_especialista():
    """
    Endpoint de alta transaccional de nuevos especialistas (RBAC Administrador/Coordinador).
    Procesa la persistencia en PostgreSQL y delega el correo de notificacion de forma asincrona.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    requester_role = user_data.get('rol', '')
    if requester_role not in ['ADMINISTRADOR', 'COORDINADOR']:
        return jsonify({"status": "error", "message": "Acceso denegado. Privilegios insuficientes."}), 403

    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON nulo o malformado."}), 400

    raw_email = payload.get('email')
    target_role = payload.get('rol', 'profesional_aps')
    
    clean_email = SecurityUtils.sanitize_email(raw_email)
    if not clean_email:
        return jsonify({"status": "error", "message": "El correo electronico proporcionado es invalido."}), 400

    existing_user = db.session.query(Especialista).filter_by(email=clean_email).first()
    if existing_user:
        return jsonify({"status": "error", "message": "El especialista ya se encuentra registrado en el sistema."}), 409

    generated_password = payload.get('password') or SecurityUtils.generate_secure_password(12)

    try:
        nuevo_especialista = Especialista(
            email=clean_email,
            password=generated_password,
            rol=target_role
        )
        
        db.session.add(nuevo_especialista)
        db.session.commit()
        
        print(f"INFO IAM: Especialista {clean_email} creado exitosamente con ID {nuevo_especialista.id}.")

        # Despacho Asincrono No Bloqueante (Evade Timeout de Render)
        EmailService.send_welcome_credentials_async(clean_email, generated_password, target_role)

        return jsonify({
            "status": "success",
            "message": "Especialista registrado correctamente. Notificacion enviada en segundo plano.",
            "data": {
                "id": nuevo_especialista.id,
                "email": nuevo_especialista.email,
                "rol": nuevo_especialista.rol
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERROR CRITICO DML: Fallo al registrar especialista. Detalle: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo interno al procesar el registro."}), 500
