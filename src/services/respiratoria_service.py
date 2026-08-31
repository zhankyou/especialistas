import uuid
from datetime import datetime
from sqlalchemy import func
from src.models import db
from src.models.respiratoria_model import FormularioRespiratoria
from src.models.especialista_model import Especialista


class RespiratoriaService:
    """
    Servicio de Dominio para la gestion transaccional del formulario de Terapia Respiratoria.
    Implementa el Patron Upsert e inyecta valores seguros en todas las columnas
    para garantizar ejecuciones DML atomicas y sin excepciones NotNullViolation.
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

            raw_nombre_prof = str(payload.get('nombre_profesional', '')).strip()
            if not raw_nombre_prof or raw_nombre_prof.lower() in ['sin asignar', 'n/a', 'none', 'null', '']:
                esp_obj = db.session.query(Especialista).filter(
                    func.lower(func.trim(Especialista.email)) == especialista_email
                ).first()
                if esp_obj and esp_obj.nombre:
                    raw_nombre_prof = esp_obj.nombre
                else:
                    raw_nombre_prof = especialista_email

            target_id = payload.get('id') or payload.get('edit_id') or payload.get('record_id')
            registro_existente = None

            if target_id:
                registro_existente = db.session.query(FormularioRespiratoria).filter_by(id=str(target_id)).first()

            sint_data = payload.get('sintomatologia') if isinstance(payload.get('sintomatologia'), dict) else {}
            plan_data = payload.get('plan_cuidado') if isinstance(payload.get('plan_cuidado'), dict) else {}
            riesgos_data = payload.get('riesgos_intradomiciliarios') if isinstance(
                payload.get('riesgos_intradomiciliarios'), dict) else {}
            acciones_data = payload.get('acciones_educacion') if isinstance(payload.get('acciones_educacion'),
                                                                            dict) else {}
            comp_fam_data = payload.get('composicion_familiar') if isinstance(payload.get('composicion_familiar'),
                                                                              list) else []
            seguim_data = payload.get('seguimiento') if isinstance(payload.get('seguimiento'), dict) else {}

            if registro_existente:
                if user_role not in ['ADMINISTRADOR',
                                     'COORDINADOR'] and registro_existente.especialista_email.lower() != especialista_email:
                    return {
                        "status": "error",
                        "message": "Acceso denegado. No posee privilegios para editar este expediente.",
                        "code": 403
                    }

                registro_existente.fecha_visita = fecha_dt
                registro_existente.territorio = str(payload.get('territorio', '')).strip()
                registro_existente.microterritorio = str(payload.get('microterritorio', '')).strip()
                registro_existente.codigo_familia = str(payload.get('codigo_familia', '')).strip()
                registro_existente.municipio = str(payload.get('municipio', 'Villavicencio')).strip()
                registro_existente.barrio = str(payload.get('barrio', '')).strip()
                registro_existente.direccion = str(payload.get('direccion', '')).strip()
                registro_existente.latitud = str(payload.get('latitud', '')).strip()
                registro_existente.longitud = str(payload.get('longitud', '')).strip()
                registro_existente.nombre_profesional = raw_nombre_prof
                registro_existente.registro_profesional = clean_reg_prof
                registro_existente.nombre_jefe_hogar = str(
                    payload.get('nombre_jefe', payload.get('nombre_jefe_hogar', ''))).strip()
                registro_existente.doc_identidad = str(payload.get('doc_identidad', '')).strip()
                registro_existente.telefono_contacto = clean_telefono
                registro_existente.total_integrantes = total_integrantes
                registro_existente.familia_visita_no = str(payload.get('visita_no', '')).strip()

                registro_existente.sintomatologia = sint_data
                registro_existente.plan_cuidado = plan_data
                registro_existente.riesgos_intradomiciliarios = riesgos_data
                registro_existente.acciones_educacion = acciones_data
                registro_existente.composicion_familiar = comp_fam_data
                registro_existente.seguimiento = seguim_data

                registro_existente.remite = remite_bool
                registro_existente.cc_profesional = str(payload.get('cc_profesional', '')).strip()
                registro_existente.cc_cuidador = str(payload.get('cc_cuidador', '')).strip()

                if payload.get('firma_profesional'):
                    registro_existente.firma_profesional = str(payload.get('firma_profesional')).strip()
                if payload.get('firma_cuidador'):
                    registro_existente.firma_cuidador = str(payload.get('firma_cuidador')).strip()

                registro_existente.synced_at = datetime.utcnow()
                db.session.commit()

                print(f"[RESPIRATORIA SERVICE] Expediente {target_id} actualizado exitosamente sin duplicacion.")
                return {
                    "status": "success",
                    "message": "Expediente de Terapia Respiratoria actualizado correctamente.",
                    "id": str(target_id),
                    "code": 200
                }
            else:
                new_record_id = str(uuid.uuid4())
                nuevo_registro = FormularioRespiratoria(
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
                    nombre_profesional=raw_nombre_prof,
                    registro_profesional=clean_reg_prof,
                    nombre_jefe_hogar=str(payload.get('nombre_jefe', payload.get('nombre_jefe_hogar', ''))).strip(),
                    doc_identidad=str(payload.get('doc_identidad', '')).strip(),
                    telefono_contacto=clean_telefono,
                    total_integrantes=total_integrantes,
                    familia_visita_no=str(payload.get('visita_no', '')).strip(),
                    sintomatologia=sint_data,
                    plan_cuidado=plan_data,
                    riesgos_intradomiciliarios=riesgos_data,
                    acciones_educacion=acciones_data,
                    composicion_familiar=comp_fam_data,
                    seguimiento=seguim_data,
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

                print(f"[RESPIRATORIA SERVICE] Nuevo expediente {new_record_id} creado exitosamente.")
                return {"status": "success", "message": "Expediente creado exitosamente.", "id": new_record_id,
                        "code": 200}

        except Exception as e:
            db.session.rollback()
            print(f"[RESPIRATORIA SERVICE ERROR] Fallo DML: {str(e)}")
            return {"status": "error", "message": "Error al procesar la valoracion de Terapia Respiratoria.",
                    "code": 500}

    @classmethod
    def get_by_id(cls, form_id: str, user_data: dict) -> dict:
        try:
            formulario = db.session.query(FormularioRespiratoria).filter_by(id=str(form_id)).first()
            if not formulario or formulario.is_deleted:
                return {"status": "error", "message": "Expediente no encontrado.", "code": 404}

            user_role = str(user_data.get('rol', '')).strip().upper()
            user_email = str(user_data.get('email', '')).strip().lower()

            if user_role not in ['ADMINISTRADOR',
                                 'COORDINADOR'] and formulario.especialista_email.lower() != user_email:
                return {"status": "error", "message": "Acceso denegado. Privilegios insuficientes.", "code": 403}

            return {"status": "success", "data": formulario.to_dict(), "code": 200}
        except Exception as e:
            print(f"[RESPIRATORIA SERVICE ERROR] Error consultando ID {form_id}: {str(e)}")
            return {"status": "error", "message": "Fallo transaccional.", "code": 500}
