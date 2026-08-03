import uuid
import re
import datetime
import json
from sqlalchemy.exc import IntegrityError
from src.models import db
from src.models.fisioterapia_model import FormularioFisioterapia
from src.services.drive_service import DriveService


class FisioterapiaService:
    @staticmethod
    def save_registro(data: dict, especialista_email: str) -> dict:
        try:
            record_id = data.get('id') or data.get('edit_id') or data.get('form_id') or data.get('record_id')
            if isinstance(record_id, str): record_id = record_id.strip()
            if not record_id: record_id = str(uuid.uuid4())

            codigo_familia = data.get('codigo_familia', '').strip()
            if codigo_familia and not re.match(r'^F\d{4}$', codigo_familia):
                return {"status": "error", "message": "El Codigo de Familia debe poseer el formato estricto 'F0000'.",
                        "code": 400}

            expediente = db.session.get(FormularioFisioterapia, record_id)
            is_new = False
            if not expediente:
                expediente = FormularioFisioterapia(id=record_id)
                db.session.add(expediente)
                is_new = True

            expediente.especialista_email = especialista_email
            expediente.synced_at = datetime.datetime.utcnow()

            evidencias_payload = data.get('evidencias', [])
            if evidencias_payload and isinstance(evidencias_payload, list):
                urls_actuales = expediente.evidencias_drive_urls or []
                if isinstance(urls_actuales, str):
                    try:
                        urls_actuales = json.loads(urls_actuales)
                    except:
                        urls_actuales = []

                territorio = data.get('territorio', getattr(expediente, 'territorio', '00'))
                microterritorio = data.get('microterritorio', getattr(expediente, 'microterritorio', '00'))
                nom_prof = str(
                    data.get('nombre_fisioterapeuta', getattr(expediente, 'nombre_fisioterapeuta', 'NoName'))).replace(
                    ' ', '_').strip()
                fecha_visita = data.get('fecha_visita', getattr(expediente, 'fecha_visita', '1970-01-01'))
                cod_fam = codigo_familia or getattr(expediente, 'codigo_familia', 'F0000')

                base_filename = f"{territorio}_{microterritorio}_{nom_prof}_{fecha_visita}_{cod_fam}_FISIO"

                for idx, file_obj in enumerate(evidencias_payload):
                    if not isinstance(file_obj, dict): continue
                    base64_data = file_obj.get('data', '')
                    if not base64_data: continue

                    mime_type = file_obj.get('type', '')
                    ext = ".pdf" if "pdf" in mime_type.lower() else ".jpg"
                    ts = datetime.datetime.now().strftime('%H%M%S')
                    filename = f"{base_filename}_Doc{idx + 1}_{ts}{ext}"

                    try:
                        url = DriveService.upload_base64_evidence(base64_data, filename, "fisioterapia")
                        if url: urls_actuales.append(url)
                    except Exception as e:
                        print(f"Error subiendo evidencia a Drive: {str(e)}")

                expediente.evidencias_drive_urls = urls_actuales

            protected_fields = ['id', 'especialista_email', 'created_at', 'synced_at', 'is_deleted', 'evidencias',
                                'evidencias_drive_urls']
            for key, value in data.items():
                if key in protected_fields or not hasattr(expediente, key):
                    continue

                if 'firma' in key.lower():
                    if isinstance(value, (dict, list)): value = json.dumps(value)
                    setattr(expediente, key, value if value else 'No registrada')
                    continue

                if key == 'fecha_visita' and isinstance(value, str):
                    try:
                        value = datetime.datetime.strptime(value, '%Y-%m-%d').date()
                    except ValueError:
                        pass

                setattr(expediente, key, value)

            db.session.commit()
            action = "creado" if is_new else "actualizado"
            print(f"INFO: Expediente Fisioterapia {record_id} {action} exitosamente.")
            return {"status": "success", "message": f"Expediente {action} correctamente.", "id": record_id, "code": 200}

        except PermissionError as e:
            db.session.rollback()
            return {"status": "error", "message": str(e), "code": 403}
        except IntegrityError as e:
            db.session.rollback()
            return {"status": "error", "message": "Fallo de integridad de datos.", "code": 400}
        except Exception as e:
            db.session.rollback()
            print(f"Error DML Fisioterapia: {str(e)}")
            return {"status": "error", "message": "Fallo interno al procesar el expediente.", "code": 500}

    @staticmethod
    def get_registro(record_id: str) -> dict:
        try:
            record = db.session.get(FormularioFisioterapia, record_id)
            if not record: return {"status": "error", "message": "No encontrado", "code": 404}
            data_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
            for k in ['fecha_visita', 'created_at', 'synced_at']:
                if data_dict.get(k): data_dict[k] = str(data_dict[k])
            return {"status": "success", "data": data_dict, "code": 200}
        except Exception as e:
            return {"status": "error", "message": "Fallo en consulta.", "code": 500}