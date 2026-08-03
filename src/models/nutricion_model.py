import uuid
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from src.models import db


class FormularioNutricion(db.Model):
    """Modelo estructurado para la Valoración Nutricional APS."""
    __tablename__ = 'formulario_nutricionista'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    especialista_email = db.Column(db.String(150), nullable=False, index=True)

    # 1. Datos Generales Estandarizados Universales (Resolución del Keyword Argument)
    fecha_visita = db.Column(db.Date, nullable=False)
    territorio = db.Column(db.String(5), nullable=False)
    microterritorio = db.Column(db.String(10), nullable=False)
    codigo_familia = db.Column(db.String(20), nullable=False, default='F0000')
    municipio = db.Column(db.String(100), nullable=False)
    barrio = db.Column(db.String(150), nullable=False)
    direccion = db.Column(db.String(250), nullable=False)
    latitud = db.Column(db.String(50), nullable=False, default='0.0')
    longitud = db.Column(db.String(50), nullable=False, default='0.0')

    nombre_nutricionista = db.Column(db.String(200), nullable=False)
    registro_profesional = db.Column(db.String(50), nullable=False, default='No registrado')
    nombre_jefe_hogar = db.Column(db.String(200), nullable=False, default='No registrado')
    doc_identidad = db.Column(db.String(20), nullable=False, default='No registrado')
    telefono_contacto = db.Column(db.String(20), nullable=False, default='No registrado')
    total_integrantes = db.Column(db.Integer, nullable=False, default=1)
    familia_visita_no = db.Column(db.String(10), nullable=False, default='01')
    no_familia = db.Column(db.String(10), nullable=True)  # Soporte a registros Legacy

    # 2, 3, 4 y 5. Datos Estructurados
    antropometria = db.Column(JSONB, nullable=False)
    seguridad_alimentaria = db.Column(JSONB, nullable=False)
    plan_cuidado = db.Column(JSONB, nullable=False)
    seguimiento = db.Column(JSONB, nullable=False)
    remite = db.Column(db.Boolean, default=False)

    # Evidencias
    evidencias_drive_urls = db.Column(JSONB, nullable=True, default=[])

    # Firmas y Documentos
    firma_profesional = db.Column(db.Text, nullable=False)
    cc_profesional = db.Column(db.String(20), nullable=True, default='No registrado')
    firma_cuidador = db.Column(db.Text, nullable=False)
    cc_cuidador = db.Column(db.String(20), nullable=True, default='No registrado')

    # ARQUITECTURA DE AUDITORÍA: Patrón Soft Delete (Borrado Lógico)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    # Auditoría
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    synced_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)