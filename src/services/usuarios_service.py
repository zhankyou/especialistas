from werkzeug.security import generate_password_hash
from src.models.especialista_model import Especialista
from src.models import db
from src.services.email_service import EmailService


class UsuariosService:
    @staticmethod
    def get_all_users():
        try:
            users = Especialista.query.order_by(Especialista.created_at.desc()).all()
            data = [{
                "id": u.id, "email": u.email, "nombre": u.nombre,
                "rol": u.rol, "is_blocked": u.is_blocked, "created_at": str(u.created_at)
            } for u in users]
            return {"status": "success", "data": data, "code": 200}
        except Exception as e:
            return {"status": "error", "message": str(e), "code": 500}

    @staticmethod
    def create_user(data):
        try:
            if Especialista.query.filter_by(email=data.get('email')).first():
                return {"status": "error", "message": "El correo ya está registrado.", "code": 409}

            raw_password = data.get('password')
            hashed_pwd = generate_password_hash(raw_password, method='pbkdf2:sha256:260000')
            target_rol = data.get('rol', 'DILIGENCIADOR')

            nuevo_user = Especialista(
                email=data.get('email'),
                nombre=data.get('nombre'),
                password_hash=hashed_pwd,
                rol=target_rol,
                is_blocked=False
            )
            db.session.add(nuevo_user)
            db.session.commit()

            # ARQUITECTURA DE EVENTOS: Despacho Asíncrono de Credenciales
            EmailService.send_welcome_email(nuevo_user.email, nuevo_user.nombre, raw_password, target_rol)

            return {"status": "success", "message": "Usuario creado. Credenciales enviadas por correo electrónico.",
                    "code": 201}
        except Exception as e:
            db.session.rollback()
            print(f"Error DML Usuarios: {str(e)}")
            return {"status": "error", "message": "Fallo interno DML al crear usuario.", "code": 500}

    @staticmethod
    def toggle_block(user_id, target_block_state):
        try:
            user = db.session.get(Especialista, user_id)
            if not user: return {"status": "error", "message": "Usuario no encontrado.", "code": 404}

            if user.rol == 'ADMINISTRADOR' and target_block_state == True:
                return {"status": "error", "message": "No se puede bloquear a un Administrador.", "code": 403}

            user.is_blocked = target_block_state
            db.session.commit()
            return {"status": "success", "message": "Estado de bloqueo actualizado.", "code": 200}
        except Exception as e:
            db.session.rollback()
            return {"status": "error", "message": "Fallo interno DML al bloquear.", "code": 500}

    @staticmethod
    def delete_user(user_id):
        try:
            user = db.session.get(Especialista, user_id)
            if not user: return {"status": "error", "message": "Usuario no encontrado.", "code": 404}

            if user.rol == 'ADMINISTRADOR':
                return {"status": "error", "message": "Un Administrador no puede ser eliminado.", "code": 403}

            db.session.delete(user)
            db.session.commit()
            return {"status": "success", "message": "Usuario eliminado físicamente.", "code": 200}
        except Exception as e:
            db.session.rollback()
            return {"status": "error", "message": "Fallo interno DML al eliminar.", "code": 500}

    @staticmethod
    def reset_password(user_id, new_password):
        try:
            user = db.session.get(Especialista, user_id)
            if not user: return {"status": "error", "message": "Usuario no encontrado.", "code": 404}

            user.password_hash = generate_password_hash(new_password, method='pbkdf2:sha256:260000')
            db.session.commit()
            return {"status": "success", "message": "Contraseña reestablecida.", "code": 200}
        except Exception as e:
            db.session.rollback()
            return {"status": "error", "message": "Fallo interno DML al resetear contraseña.", "code": 500}