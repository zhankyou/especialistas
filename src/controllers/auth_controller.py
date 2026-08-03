from flask import Blueprint, request, jsonify
from src.models import db
from src.models.especialista_model import Especialista
from src.services.email_service import EmailService
from src.utils.security_utils import SecurityUtils
from src.utils.auth_utils import get_user_from_request

auth_bp = Blueprint('auth_bp', __name__)


@auth_bp.route('/api/auth/register', methods=['POST'])
def register_especialista():
    """
    Endpoint de alta transaccional de nuevos especialistas (RBAC Administrador/Coordinador).
    Procesa la persistencia en PostgreSQL Aiven y delega el correo de notificacion de forma asincrona.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

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

    # Validacion de existencia previa (OWASP A04:2021)
    existing_user = db.session.query(Especialista).filter_by(email=clean_email).first()
    if existing_user:
        return jsonify({"status": "error", "message": "El especialista ya se encuentra registrado en el sistema."}), 409

    # Generacion criptografica de contraseña e insercion en DB
    generated_password = payload.get('password') or SecurityUtils.generate_secure_password(12)

    try:
        nuevo_especialista = Especialista(
            email=clean_email,
            password=generated_password,
            rol=target_role
        )

        db.session.add(nuevo_especialista)
        db.session.commit()

        print(f"INFO: Especialista {clean_email} creado exitosamente con ID {nuevo_especialista.id}.")

        # Despacho Asincrono No Bloqueante
        # El proceso responde en < 50ms evadiendo el Timeout de Render
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
