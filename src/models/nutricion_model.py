import uuid
import json
from datetime import datetime
from src.models import db


class FormularioNutricion(db.Model):
    """
    Modelo ORM para la entidad formulario_nutricionista en PostgreSQL.
    Incluye mapeo para 'seguimiento' con metodos defensivos de parsing JSON.
    """
    __tablename__ = 'formulario_nutricionista'

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
    nombre_nutricionista = db.Column(db.String(150), nullable=False)
    registro_profesional = db.Column(db.String(10), nullable=False)
    nombre_jefe_hogar = db.Column(db.String(150), nullable=False)
    doc_identidad = db.Column(db.String(50), nullable=False)
    telefono_contacto = db.Column(db.String(10), nullable=False)
    total_integrantes = db.Column(db.Integer, nullable=False)
    familia_visita_no = db.Column(db.String(10), nullable=False)

    antropometria = db.Column(db.JSON, nullable=True)
    seguridad_alimentaria = db.Column(db.JSON, nullable=True)
    plan_cuidado = db.Column(db.JSON, nullable=True)
    seguimiento = db.Column(db.JSON, nullable=True)

    acc_disp = db.Column(db.String(50), nullable=True)
    consumo = db.Column(db.String(50), nullable=True)
    hfias = db.Column(db.String(10), nullable=True)
    lineas_accion = db.Column(db.JSON, nullable=True)
    lineas_otra = db.Column(db.Text, nullable=True)
    compromiso = db.Column(db.Text, nullable=True)
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
        lineas = self._deep_parse_json(self.lineas_accion, default_type=list)
        antrop = self._deep_parse_json(self.antropometria, default_type=list)
        seg_alim = self._deep_parse_json(self.seguridad_alimentaria, default_type=dict)
        plan_cuid = self._deep_parse_json(self.plan_cuidado, default_type=dict)
        seguim = self._deep_parse_json(self.seguimiento, default_type=dict)

        acc_disp_val = str(self.acc_disp or seg_alim.get('acc_disp') or "").strip()
        consumo_val = str(self.consumo or seg_alim.get('consumo') or "").strip()
        hfias_val = str(self.hfias or seg_alim.get('hfias') or "").strip()

        remite_str = "SI" if self.remite is True or str(self.remite).upper() in ['SI', 'SÍ', 'TRUE', '1'] else "NO"

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
            "nombre_nutricionista": str(self.nombre_nutricionista or ""),
            "registro_profesional": str(self.registro_profesional or ""),
            "nombre_jefe_hogar": str(self.nombre_jefe_hogar or ""),
            "doc_identidad": str(self.doc_identidad or ""),
            "telefono_contacto": str(self.telefono_contacto or ""),
            "total_integrantes": int(self.total_integrantes or 1),
            "familia_visita_no": str(self.familia_visita_no or "01"),
            "antropometria": antrop,
            "acc_disp": acc_disp_val,
            "consumo": consumo_val,
            "hfias": hfias_val,
            "seguridad_alimentaria": {
                "acc_disp": acc_disp_val,
                "consumo": consumo_val,
                "hfias": hfias_val,
                "estado_compuesto": f"{acc_disp_val} | {consumo_val} | {hfias_val}"
            },
            "plan_cuidado": plan_cuid,
            "seguimiento": seguim,
            "lineas_accion": lineas if isinstance(lineas, list) else [lineas] if lineas else [],
            "lineas_otra": str(self.lineas_otra or plan_cuid.get('lineas_otra') or ""),
            "compromiso": str(self.compromiso or plan_cuid.get('compromiso') or ""),
            "remite": remite_str,
            "cc_profesional": str(self.cc_profesional or ""),
            "cc_cuidador": str(self.cc_cuidador or ""),
            "firma_profesional": str(self.firma_profesional or ""),
            "firma_cuidador": str(self.firma_cuidador or ""),
            "is_deleted": bool(self.is_deleted),
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else ""
        }
