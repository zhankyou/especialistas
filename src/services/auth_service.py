import jwt
import datetime
from src.models import db
from src.models.especialista_model import Especialista
from config.settings import Config


class AuthService:
    @staticmethod
    def authenticate_user(email, password):
        """
        Verifica credenciales utilizando consultas de sesion explicitas (SQLAlchemy 2.0).
        Genera JWT con validez de 48 horas.
        """
        if not email or not password:
            return {"status": "error", "message": "Email y contrasena son requeridos.", "code": 400}

        # ARQUITECTURA: Migracion a sintaxis moderna SQLAlchemy 2.0 / Flask-SQLAlchemy 3.x
        # En lugar de usar Especialista.query (que falla si hay bifurcacion de contexto),
        # forzamos el uso de la sesion vinculada explicitamente.
        stmt = db.select(Especialista).filter_by(email=email)
        user = db.session.execute(stmt).scalar_one_or_none()

        if not user or not user.verify_password(password):
            return {"status": "error", "message": "Credenciales invalidas.", "code": 401}

        if not user.is_active:
            return {"status": "error", "message": "Usuario inactivo. Contacte al administrador de plataforma.",
                    "code": 403}

        expiration_time = datetime.datetime.utcnow() + Config.JWT_EXPIRATION_DELTA
        payload = {
            'user_id': user.id,
            'email': user.email,
            'role': user.rol,
            'exp': expiration_time,
            'iat': datetime.datetime.utcnow()
        }

        try:
            token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')
            return {
                "status": "success",
                "message": "Autenticacion exitosa.",
                "token": token,
                "role": user.rol,
                "email": user.email,
                "expires_at": expiration_time.timestamp() * 1000,
                "code": 200
            }
        except Exception as e:
            return {"status": "error", "message": "Error interno en el proveedor de identidades.", "code": 500}


# Guardarrail arquitectonico
if __name__ == '__main__':
    import sys

    sys.exit(1)