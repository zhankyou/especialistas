import uuid
import json
from datetime import datetime
from src.models import db


class FormularioFisioterapia(db.Model):
    """
    Modelo ORM para la entidad formulario_fisioterapia en PostgreSQL.
    Mapea de forma exhaustiva todas las columnas del esquema Cloud con
    deserialización defensiva de objetos JSON.
    """
    __tablename__ = 'formulario_fisioterapia'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    especialista_email = db.Column(db.String(150), nullable=False, index=True)
    fecha_visita = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    territorio = db.Column(db.String(10), nullable=False)
    microterritorio = db.Column(db.String(10), nullable=False)
    codigo_familia = db.Column(db.String(50), nullable=False)
    municipio = db.Column(db.String(100), nullable=False, default='Villavicencio')
    barrio = db.Column(db.String(100), nullable=False)
    direccion = db.Column(db.String(200), nullable=False)
    latitud = db.Column(db.String(50), nullable=True)
    longitud = db.Column(db.String(50), nullable=True)

    nombre_fisio = db.Column(db.String(150), nullable=True)
    nombre_fisioterapeuta = db.Column(db.String(150), nullable=True)

    registro_profesional = db.Column(db.String(10), nullable=False)
    nombre_jefe_hogar = db.Column(db.String(150), nullable=False)
    doc_identidad = db.Column(db.String(50), nullable=False)
    telefono_contacto = db.Column(db.String(10), nullable=False)
    total_integrantes = db.Column(db.Integer, nullable=False)
    familia_visita_no = db.Column(db.String(10), nullable=False)

    evaluacion = db.Column(db.JSON, nullable=True)
    plan_cuidado = db.Column(db.JSON, nullable=True)
    acciones_educacion = db.Column(db.JSON, nullable=True)
    seguimiento = db.Column(db.JSON, nullable=True)
    tamizaje_motor = db.Column(db.JSON, nullable=True)
    riesgo_caidas = db.Column(db.JSON, nullable=True)
    barreras_arquitectonicas = db.Column(db.JSON, nullable=True)
    riesgo_ergonomico = db.Column(db.JSON, nullable=True)
    canalizacion = db.Column(db.JSON, nullable=True)
    sintesis_analisis = db.Column(db.JSON, nullable=True)
    metas = db.Column(db.JSON, nullable=True)

    remite = db.Column(db.Boolean, nullable=False, default=False)
    cc_profesional = db.Column(db.String(50), nullable=False)
    cc_cuidador = db.Column(db.String(50), nullable=False)

    firma_profesional = db.Column(db.Text, nullable=True)
    firma_cuidador = db.Column(db.Text, nullable=True)

    is_deleted = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    synced_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def _deep_parse_json(self, raw_value, default_type=dict):
        if not raw_value:
            return default_type()

        if isinstance(raw_value, default_type):
            return raw_value

        current = raw_value
        for _ in range(3):
            if isinstance(current, str):
                cleaned = current.strip()
                if (cleaned.startswith('{') and cleaned.endswith('}')) or (
                        cleaned.startswith('[') and cleaned.endswith(']')):
                    try:
                        current = json.loads(cleaned)
                    except Exception:
                        break
                else:
                    break
            else:
                break

        if isinstance(current, default_type):
            return current
        return default_type()

    def to_dict(self):
        eval_dict = self._deep_parse_json(self.evaluacion, default_type=dict)
        plan_dict = self._deep_parse_json(self.plan_cuidado, default_type=dict)
        acciones_dict = self._deep_parse_json(self.acciones_educacion, default_type=dict)
        seguim_dict = self._deep_parse_json(self.seguimiento, default_type=dict)
        tamiz_dict = self._deep_parse_json(self.tamizaje_motor, default_type=list)
        caidas_dict = self._deep_parse_json(self.riesgo_caidas, default_type=list)
        barreras_dict = self._deep_parse_json(self.barreras_arquitectonicas, default_type=list)
        ergo_dict = self._deep_parse_json(self.riesgo_ergonomico, default_type=list)
        canal_dict = self._deep_parse_json(self.canalizacion, default_type=dict)
        sintesis_dict = self._deep_parse_json(self.sintesis_analisis, default_type=dict)
        metas_dict = self._deep_parse_json(self.metas, default_type=dict)

        remite_str = "SI" if self.remite is True or str(self.remite).upper() in ['SI', 'SÍ', 'TRUE', '1'] else "NO"
        nombre_prof = str(self.nombre_fisio or self.nombre_fisioterapeuta or "").strip()

        return {
            "id": str(self.id),
            "especialista_email": str(self.especialista_email or ""),
            "fecha_visita": self.fecha_visita.strftime('%Y-%m-%d') if self.fecha_visita else "",
            "territorio": str(self.territorio or ""),
            "microterritorio": str(self.microterritorio or ""),
            "codigo_familia": str(self.codigo_familia or ""),
            "municipio": str(self.municipio or "Villavicencio"),
            "barrio": str(self.barrio or ""),
            "direccion": str(self.direccion or ""),
            "latitud": str(self.latitud or ""),
            "longitud": str(self.longitud or ""),
            "nombre_fisio": nombre_prof,
            "nombre_fisioterapeuta": nombre_prof,
            "registro_profesional": str(self.registro_profesional or ""),
            "nombre_jefe_hogar": str(self.nombre_jefe_hogar or ""),
            "doc_identidad": str(self.doc_identidad or ""),
            "telefono_contacto": str(self.telefono_contacto or ""),
            "total_integrantes": int(self.total_integrantes or 1),
            "familia_visita_no": str(self.familia_visita_no or "01"),
            "evaluacion": eval_dict,
            "plan_cuidado": plan_dict,
            "acciones_educacion": acciones_dict,
            "seguimiento": seguim_dict,
            "tamizaje_motor": tamiz_dict,
            "riesgo_caidas": caidas_dict,
            "barreras_arquitectonicas": barreras_dict,
            "riesgo_ergonomico": ergo_dict,
            "canalizacion": canal_dict,
            "sintesis_analisis": sintesis_dict,
            "metas": metas_dict,
            "remite": remite_str,
            "cc_profesional": str(self.cc_profesional or ""),
            "cc_cuidador": str(self.cc_cuidador or ""),
            "firma_profesional": str(self.firma_profesional or ""),
            "firma_cuidador": str(self.firma_cuidador or ""),
            "is_deleted": bool(self.is_deleted),
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else ""
        }
