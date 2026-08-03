import uuid
from datetime import datetime
from src.models import db


class Especialista(db.Model):
    """
    Modelo Core para la Gestión de Identidades (IAM).
    Implementa directrices de ISO 27001 para autenticación y control de accesos.
    """
    __tablename__ = 'especialista'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    nombre = db.Column(db.String(200), nullable=False)
    registro_profesional = db.Column(db.String(50), nullable=True)

    # Sistema de Control de Acceso Basado en Roles (RBAC)
    rol = db.Column(db.String(50), nullable=False, default='DILIGENCIADOR')

    # Bloqueo Preventivo de Cuentas (OWASP Access Control)
    is_blocked = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)