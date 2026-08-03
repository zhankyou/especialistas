import uuid
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from src.models import db


class Especialista(db.Model):
    """
    Modelo relacional para autenticacion y control de acceso (RBAC).
    Mapeo estricto para satisfacer restricciones NOT NULL del esquema legacy.
    """
    __tablename__ = 'especialista'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = db.Column(db.String(150), nullable=True, default='Profesional APS')
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    rol = db.Column(db.String(50), nullable=False, default='PROFESIONAL_APS')

    # Sincronizacion de atributos booleanos de estado para bases de datos heredadas
    is_active = db.Column(db.Boolean, default=True, nullable=True)
    is_blocked = db.Column(db.Boolean, default=False, nullable=False)

    # Mitigaciones de Seguridad (Fuerza Bruta)
    failed_login_attempts = db.Column(db.Integer, default=0, nullable=True)
    account_locked_until = db.Column(db.DateTime, nullable=True)

    # Telemetria y Auditoria
    last_login_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    def __init__(self, email, password, rol='PROFESIONAL_APS', nombre='Profesional APS'):
        self.email = email
        self.nombre = nombre
        self.set_password(password)
        self.rol = rol.upper()
        self.is_active = True
        self.is_blocked = False

    def set_password(self, password):
        """Genera un hash seguro mediante PBKDF2 iterativo."""
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256:600000')

    def verify_password(self, password):
        """Verifica la contrasena y aplica auto-remadiacion criptografica."""
        if not self.password_hash:
            return False

        if not self.password_hash.startswith('pbkdf2:') and not self.password_hash.startswith('scrypt:'):
            if self.password_hash == password:
                print(f"[SECURITY INFO] Upgrade criptografico automatico para: {self.email}")
                self.set_password(password)
                return True
            return False

        return check_password_hash(self.password_hash, password)

    def is_locked(self):
        """Verifica restricciones temporales de acceso por politicas Anti-Brute Force."""
        if self.account_locked_until:
            if datetime.utcnow() < self.account_locked_until:
                return True
            else:
                self.failed_login_attempts = 0
                self.account_locked_until = None
                return False
        return False