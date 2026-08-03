from sqlalchemy import func
from src.models import db
from src.models.especialista_model import Especialista
from src.utils.security_utils import SecurityUtils
from flask import current_app
from src.services.email_service import EmailService


class UsuariosService:
    """
    Capa de Dominio. Intermediario estricto entre el Controlador y PostgreSQL.
    Garantiza la atomicidad de transacciones y validacion de restricciones DDL.
    """

    @classmethod
    def get_all_users(cls):
        try:
            usuarios = db.session.query(Especialista).order_by(Especialista.created_at.desc()).all()
            data_list = [{
                "id": u.id,
                "nombre": u.nombre or "Profesional APS",
                "email": u.email,
                "rol": u.rol,
                "is_blocked": getattr(u, 'is_blocked', not getattr(u, 'is_active', True))
            } for u in usuarios]

            return {"status": "success", "data": data_list, "code": 200}
        except Exception as e:
            print(f"[DB ERROR] Error al extraer usuarios: {str(e)}")
            return {"status": "error", "message": "Error interno del servidor de Base de Datos.", "code": 500}

    @classmethod
    def create_user(cls, data):
        raw_email = data.get('email')
        nombre = data.get('nombre', 'Profesional APS')
        rol = data.get('rol', 'PROFESIONAL_APS').upper()

        clean_email = SecurityUtils.sanitize_email_strict(raw_email)
        if not clean_email:
            return {"status": "error", "message": "Formato de correo electronico invalido.", "code": 400}

        try:
            existing = db.session.query(Especialista).filter(
                func.lower(func.trim(Especialista.email)) == func.lower(func.trim(clean_email))
            ).first()

            if existing:
                return {"status": "error", "message": "El correo ya se encuentra registrado en el sistema.",
                        "code": 409}

            raw_password = data.get('password') or SecurityUtils.generate_secure_password(12)

            nuevo_usuario = Especialista(
                email=clean_email,
                password=raw_password,
                rol=rol,
                nombre=nombre
            )

            # Satisfaccion explicita de los constraints DDL
            nuevo_usuario.is_blocked = False
            nuevo_usuario.is_active = True

            db.session.add(nuevo_usuario)
            db.session.commit()

            # Extraccion del proxy local (Object Proxy Extraction)
            app_obj = current_app._get_current_object()

            # Despacho Asincrono
            EmailService.send_welcome_credentials_async(app_obj, clean_email, raw_password, rol)

            return {"status": "success",
                    "message": f"Usuario {clean_email} creado correctamente. Credenciales enviadas.", "code": 201}
        except Exception as e:
            db.session.rollback()
            print(f"[DB ERROR] Fallo DML al crear usuario: {str(e)}")
            return {"status": "error", "message": "Fallo en la transaccion de creacion de usuario.", "code": 500}

    @classmethod
    def toggle_block(cls, user_id, is_blocked):
        try:
            user = db.session.query(Especialista).filter_by(id=user_id).first()
            if not user:
                return {"status": "error", "message": "Usuario no encontrado.", "code": 404}

            # Sincronizacion de ambos estados logicos
            user.is_active = not is_blocked
            user.is_blocked = is_blocked

            if not is_blocked:
                user.failed_login_attempts = 0
                user.account_locked_until = None

            db.session.commit()
            estado = "bloqueado" if is_blocked else "desbloqueado"
            return {"status": "success", "message": f"Usuario {estado} exitosamente.", "code": 200}
        except Exception as e:
            db.session.rollback()
            print(f"[DB ERROR] Error al alternar bloqueo: {str(e)}")
            return {"status": "error", "message": "Error al actualizar estado del usuario.", "code": 500}

    @classmethod
    def delete_user(cls, user_id):
        try:
            user = db.session.query(Especialista).filter_by(id=user_id).first()
            if not user:
                return {"status": "error", "message": "Usuario no encontrado.", "code": 404}

            db.session.delete(user)
            db.session.commit()
            print(f"[IAM AUDIT] Usuario {user.email} eliminado permanentemente por un Administrador.")
            return {"status": "success", "message": "Usuario eliminado del sistema.", "code": 200}
        except Exception as e:
            db.session.rollback()
            return {"status": "error", "message": "Fallo al ejecutar eliminacion en Base de Datos.", "code": 500}

    @classmethod
    def reset_password(cls, user_id, new_password):
        if not new_password or len(new_password) < 8:
            return {"status": "error", "message": "La nueva contrasena debe tener al menos 8 caracteres.", "code": 400}

        try:
            user = db.session.query(Especialista).filter_by(id=user_id).first()
            if not user:
                return {"status": "error", "message": "Usuario no encontrado.", "code": 404}

            user.set_password(new_password)
            user.failed_login_attempts = 0
            user.account_locked_until = None
            db.session.commit()

            return {"status": "success", "message": "Credenciales restablecidas correctamente.", "code": 200}
        except Exception as e:
            db.session.rollback()
            return {"status": "error", "message": "Error al restablecer la contrasena.", "code": 500}