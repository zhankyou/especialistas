import uuid
from datetime import datetime
from src.models import db


class RegistroAPS(db.Model):
    """
    Entidad de Dominio para los Registros Clinicos APS.
    Implementa patron Soft Delete para cumplimiento de auditoria ISO 27001.
    """
    __tablename__ = 'registros_aps'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    paciente_nombre = db.Column(db.String(150), nullable=False)
    paciente_documento = db.Column(db.String(50), nullable=False, index=True)
    especialidad = db.Column(db.String(50), nullable=False)
    profesional_email = db.Column(db.String(150), nullable=False, index=True)
    estado_sincronizacion = db.Column(db.String(20), default='SINCRONIZADO', nullable=False)

    # Geolocalizacion (Type: Float)
    latitud = db.Column(db.Float, nullable=True)
    longitud = db.Column(db.Float, nullable=True)

    # Control de Estado (Soft Delete)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    observaciones = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Serializador del objeto relacional."""
        return {
            "id": self.id,
            "paciente_nombre": self.paciente_nombre,
            "paciente_documento": self.paciente_documento,
            "especialidad": self.especialidad,
            "profesional_email": self.profesional_email,
            "estado_sincronizacion": self.estado_sincronizacion,
            "latitud": self.latitud,
            "longitud": self.longitud,
            "is_deleted": self.is_deleted,
            "observaciones": self.observaciones or "",
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else ""
        }
