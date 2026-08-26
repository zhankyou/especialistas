import uuid
from datetime import datetime
from src.models import db


class RegistroAPS(db.Model):
    """
    Entidad de Dominio Maestra para los Registros Clinicos APS.
    Actua como Indice Global Consolidado para el Dashboard de Administracion.
    Sincronizada dinamicamente mediante el Middleware Interceptor de app.py.
    """
    __tablename__ = 'registros_aps'

    id = db.Column(db.String(36), primary_key=True)
    modulo = db.Column(db.String(50), nullable=False, default='general')
    codigo_familia = db.Column(db.String(50), nullable=False, default='N/A')
    nombre_jefe_hogar = db.Column(db.String(150), nullable=False, default='N/A')
    doc_identidad = db.Column(db.String(50), nullable=False, index=True, default='00000000')
    especialista_email = db.Column(db.String(150), nullable=False, index=True)
    fecha_visita = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Control de Estado Transaccional (Soft Delete)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Serializador del objeto relacional alineado milimetricamente al Frontend SPA."""
        return {
            "id": self.id,
            "modulo": self.modulo,
            "codigo_familia": self.codigo_familia,
            "nombre_jefe_hogar": self.nombre_jefe_hogar,
            "doc_identidad": self.doc_identidad,
            "especialista_email": self.especialista_email,
            "fecha_visita": self.fecha_visita.strftime('%Y-%m-%d %H:%M:%S') if self.fecha_visita else "",
            "is_deleted": self.is_deleted
        }
