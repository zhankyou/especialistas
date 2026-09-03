import uuid
from datetime import datetime
from sqlalchemy import func
from src.models import db
from src.models.fisioterapia_model import FormularioFisioterapia
from src.models.especialista_model import Especialista


class FisioterapiaService:
    """
    Servicio de Dominio para la gestion transaccional del formulario de Fisioterapia.
    Garantiza persistencia segura en operaciones Upsert inyectando estructuras validas
    en todas las columnas JSON e integra subida asíncrona a Google Drive.
    """

    @classmethod
    def save_form(cls, payload: dict, user_data: dict) -> dict:
        try:
            especialista_email = str(user_data.get('email', 'SISTEMA')).strip().lower()
            user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()

            remite_bool = str(payload.get('remite', '')).strip().upper() in ['SI', 'SÍ', 'TRUE', '1']
            clean_telefono = "".join(
                filter(str.isdigit, str(payload.get('telefono', payload.get('telefono_contacto', '')))))[
                                 :10] or "0000000000"
            clean_reg_prof = "".join(filter(str.isdigit, str(payload.get('reg_profesional', ''))))[:10]

            try:
                total_integrantes = max(1, min(20, int(payload.get('total_integrantes', 1))))
            except (ValueError, TypeError):
                total_integrantes = 1

            raw_fecha = payload.get('fecha_visita')
            fecha_dt = datetime.strptime(raw_fecha, '%Y-%m-%d') if raw_fecha else datetime.utcnow()

            raw_nombre_fisio = str(payload.get('nombre_fisio', payload.get('nombre_fisioterapeuta',
                                                                           payload.get('nombre_profesional',
                                                                                       '')))).strip()
            if not raw_nombre_fisio or raw_nombre_fisio.lower() in ['sin asignar', 'n/a', 'none', 'null', '']:
                esp_obj = db.session.query(Especialista).filter(
                    func.lower(func.trim(Especialista.email)) == especialista_email
                ).first()
                if esp_obj and esp_obj.nombre:
                    raw_nombre_fisio = esp_obj.nombre
                else:
                    raw_nombre_fisio = especialista_email

            target_id = payload.get('id') or payload.get('edit_id') or payload.get('record_id')
            registro_existente = None

            if target_id:
                registro_existente = db.session.query(FormularioFisioterapia).filter_by(id=str(target_id)).first()

            eval_data = payload.get('evaluacion') if isinstance(payload.get('evaluacion'), dict) else {}
            plan_data = payload.get('plan_cuidado') if isinstance(payload.get('plan_cuidado'), dict) else {}
            acciones_data = payload.get('acciones_educacion') if isinstance(payload.get('acciones_educacion'),
                                                                            dict) else {}
            seguim_data = payload.get('seguimiento') if isinstance(payload.get('seguimiento'), dict) else {}

            tamiz_data = payload.get('tamizaje_motor') if isinstance(payload.get('tamizaje_motor'), list) else []
            caidas_data = payload.get('riesgo_caidas') if isinstance(payload.get('riesgo_caidas'), list) else []
            barreras_data = payload.get('barreras_arquitectonicas') if isinstance(
                payload.get('barreras_arquitectonicas'), list) else []
            ergo_data = payload.get('riesgo_ergonomico') if isinstance(payload.get('riesgo_ergonomico'), list) else []

            canal_data = payload.get('canalizacion') if isinstance(payload.get('canalizacion'), dict) else {}
            sintesis_data = payload.get('sintesis_analisis') if isinstance(payload.get('sintesis_analisis'),
                                                                           dict) else {}
            metas_data = payload.get('metas') if isinstance(payload.get('metas'), dict) else {}

            # PROCESAMIENTO MULTIMEDIA HACIA GOOGLE DRIVE
            evidencias_payload = payload.get('evidencias', [])
            evidencias_procesadas = []

            if evidencias_payload:
                from src.services.drive_service import DriveService
                for idx, ev in enumerate(evidencias_payload):
                    b64_data = ev.get('data')
                    f_name = ev.get('nombre')
                    if b64_data and f_name:
                        safe_name = f"{str(payload.get('codigo_familia', 'FAM'))}_{idx}_{f_name}"
                        link = DriveService.upload_base64_evidence(b64_data, safe_name, 'fisioterapia')
                        if link:
                            evidencias_procesadas.append({"nombre": safe_name, "url": link})

            if registro_existente:
                if user_role not in ['ADMINISTRADOR',
                                     'COORDINADOR'] and registro_existente.especialista_email.lower() != especialista_email:
                    return {
                        "status": "error",
                        "message": "Acceso denegado. No posee privilegios para editar este expediente.",
                        "code": 403
                    }

                # Anexado In-Place de URLs de Drive
                urls_existentes = registro_existente.evidencias_drive_urls or []
                if not isinstance(urls_existentes, list):
                    urls_existentes = []
                urls_existentes.extend(evidencias_procesadas)

                registro_existente.fecha_visita = fecha_dt
                registro_existente.territorio = str(payload.get('territorio', '')).strip()
                registro_existente.microterritorio = str(payload.get('microterritorio', '')).strip()
                registro_existente.codigo_familia = str(payload.get('codigo_familia', '')).strip()
                registro_existente.municipio = str(payload.get('municipio', 'Villavicencio')).strip()
                registro_existente.barrio = str(payload.get('barrio', '')).strip()
                registro_existente.direccion = str(payload.get('direccion', '')).strip()
                registro_existente.latitud = str(payload.get('latitud', '')).strip()
                registro_existente.longitud = str(payload.get('longitud', '')).strip()

                registro_existente.nombre_fisio = raw_nombre_fisio
                registro_existente.nombre_fisioterapeuta = raw_nombre_fisio

                registro_existente.registro_profesional = clean_reg_prof
                registro_existente.nombre_jefe_hogar = str(
                    payload.get('nombre_jefe', payload.get('nombre_jefe_hogar', ''))).strip()
                registro_existente.doc_identidad = str(payload.get('doc_identidad', '')).strip()
                registro_existente.telefono_contacto = clean_telefono
                registro_existente.total_integrantes = total_integrantes
                registro_existente.familia_visita_no = str(payload.get('visita_no', '')).strip()

                registro_existente.evaluacion = eval_data
                registro_existente.plan_cuidado = plan_data
                registro_existente.acciones_educacion = acciones_data
                registro_existente.seguimiento = seguim_data
                registro_existente.tamizaje_motor = tamiz_data
                registro_existente.riesgo_caidas = caidas_data
                registro_existente.barreras_arquitectonicas = barreras_data
                registro_existente.riesgo_ergonomico = ergo_data
                registro_existente.canalizacion = canal_data
                registro_existente.sintesis_analisis = sintesis_data
                registro_existente.metas = metas_data
                registro_existente.evidencias_drive_urls = urls_existentes

                registro_existente.remite = remite_bool
                registro_existente.cc_profesional = str(payload.get('cc_profesional', '')).strip()
                registro_existente.cc_cuidador = str(payload.get('cc_cuidador', '')).strip()

                if payload.get('firma_profesional'):
                    registro_existente.firma_profesional = str(payload.get('firma_profesional')).strip()
                if payload.get('firma_cuidador'):
                    registro_existente.firma_cuidador = str(payload.get('firma_cuidador')).strip()

                registro_existente.synced_at = datetime.utcnow()
                db.session.commit()

                return {
                    "status": "success",
                    "message": "Expediente de Fisioterapia actualizado correctamente.",
                    "id": str(target_id),
                    "code": 200
                }
            else:
                new_record_id = str(uuid.uuid4())
                nuevo_registro = FormularioFisioterapia(
                    id=new_record_id,
                    especialista_email=especialista_email,
                    fecha_visita=fecha_dt,
                    territorio=str(payload.get('territorio', '')).strip(),
                    microterritorio=str(payload.get('microterritorio', '')).strip(),
                    codigo_familia=str(payload.get('codigo_familia', '')).strip(),
                    municipio=str(payload.get('municipio', 'Villavicencio')).strip(),
                    barrio=str(payload.get('barrio', '')).strip(),
                    direccion=str(payload.get('direccion', '')).strip(),
                    latitud=str(payload.get('latitud', '')).strip(),
                    longitud=str(payload.get('longitud', '')).strip(),
                    nombre_fisio=raw_nombre_fisio,
                    nombre_fisioterapeuta=raw_nombre_fisio,
                    registro_profesional=clean_reg_prof,
                    nombre_jefe_hogar=str(payload.get('nombre_jefe', payload.get('nombre_jefe_hogar', ''))).strip(),
                    doc_identidad=str(payload.get('doc_identidad', '')).strip(),
                    telefono_contacto=clean_telefono,
                    total_integrantes=total_integrantes,
                    familia_visita_no=str(payload.get('visita_no', '')).strip(),
                    evaluacion=eval_data,
                    plan_cuidado=plan_data,
                    acciones_educacion=acciones_data,
                    seguimiento=seguim_data,
                    tamizaje_motor=tamiz_data,
                    riesgo_caidas=caidas_data,
                    barreras_arquitectonicas=barreras_data,
                    riesgo_ergonomico=ergo_data,
                    canalizacion=canal_data,
                    sintesis_analisis=sintesis_data,
                    metas=metas_data,
                    evidencias_drive_urls=evidencias_procesadas,
                    remite=remite_bool,
                    cc_profesional=str(payload.get('cc_profesional', '')).strip(),
                    cc_cuidador=str(payload.get('cc_cuidador', '')).strip(),
                    firma_profesional=str(payload.get('firma_profesional', '')).strip(),
                    firma_cuidador=str(payload.get('firma_cuidador', '')).strip(),
                    is_deleted=False,
                    created_at=datetime.utcnow(),
                    synced_at=datetime.utcnow()
                )

                db.session.add(nuevo_registro)
                db.session.commit()

                return {"status": "success", "message": "Expediente creado exitosamente.", "id": new_record_id,
                        "code": 200}

        except Exception as e:
            db.session.rollback()
            print(f"[FISIOTERAPIA SERVICE ERROR] Fallo DML: {str(e)}")
            return {"status": "error", "message": "Error al procesar la valoracion de Fisioterapia.", "code": 500}

    @classmethod
    def get_by_id(cls, form_id: str, user_data: dict) -> dict:
        try:
            formulario = db.session.query(FormularioFisioterapia).filter_by(id=str(form_id)).first()
            if not formulario or formulario.is_deleted:
                return {"status": "error", "message": "Expediente no encontrado.", "code": 404}

            user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
            user_email = str(user_data.get('email', '')).strip().lower()

            if user_role not in ['ADMINISTRADOR',
                                 'COORDINADOR'] and formulario.especialista_email.lower() != user_email:
                return {"status": "error", "message": "Acceso denegado. Privilegios insuficientes.", "code": 403}

            return {"status": "success", "data": formulario.to_dict(), "code": 200}
        except Exception as e:
            print(f"[FISIOTERAPIA SERVICE ERROR] Error consultando ID {form_id}: {str(e)}")
            return {"status": "error", "message": "Fallo transaccional.", "code": 500}
