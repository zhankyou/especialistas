import uuid
from datetime import datetime
from sqlalchemy import func
from src.models import db
from src.models.nutricion_model import FormularioNutricion
from src.models.especialista_model import Especialista


class NutricionService:
    """
    Servicio de Dominio para la gestion transaccional del formulario de Nutricion.
    Implementa el Patron Upsert (Update/Insert) para evitar duplicacion de registros en edicion.
    """

    @classmethod
    def save_form(cls, payload: dict, user_data: dict) -> dict:
        try:
            especialista_email = str(user_data.get('email', 'SISTEMA')).strip().lower()
            user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()

            raw_remite = str(payload.get('remite', '')).strip().upper()
            remite_bool = raw_remite in ['SI', 'SÍ', 'TRUE', '1']

            raw_telefono = str(payload.get('telefono', payload.get('telefono_contacto', ''))).strip()
            clean_telefono = "".join(filter(str.isdigit, raw_telefono))[:10] or "0000000000"

            raw_reg_prof = str(payload.get('reg_profesional', '')).strip()
            clean_reg_prof = "".join(filter(str.isdigit, raw_reg_prof))[:10]

            try:
                total_integrantes = max(1, min(20, int(payload.get('total_integrantes', 1))))
            except (ValueError, TypeError):
                total_integrantes = 1

            raw_fecha = payload.get('fecha_visita')
            fecha_dt = datetime.strptime(raw_fecha, '%Y-%m-%d') if raw_fecha else datetime.utcnow()

            acc_disp = str(payload.get('acc_disp', '')).strip()
            consumo = str(payload.get('consumo', '')).strip()
            hfias = str(payload.get('hfias', '')).strip()

            lineas_accion = payload.get('lineas_accion', [])
            lineas_otra = str(payload.get('lineas_otra', '')).strip()
            compromiso = str(payload.get('compromiso', '')).strip()

            legacy_seguridad_json = {
                "acc_disp": acc_disp,
                "consumo": consumo,
                "hfias": hfias,
                "estado_compuesto": f"{acc_disp} | {consumo} | {hfias}"
            }

            legacy_plan_cuidado_json = {
                "lineas_accion": lineas_accion,
                "lineas_otra": lineas_otra,
                "compromiso": compromiso
            }

            raw_nombre_nutri = str(payload.get('nombre_nutricionista', '')).strip()
            if not raw_nombre_nutri or raw_nombre_nutri.lower() in ['sin asignar', 'n/a', 'none', 'null', '']:
                esp_obj = db.session.query(Especialista).filter(
                    func.lower(func.trim(Especialista.email)) == especialista_email
                ).first()
                if esp_obj and esp_obj.nombre:
                    raw_nombre_nutri = esp_obj.nombre
                else:
                    raw_nombre_nutri = especialista_email

            target_id = payload.get('id') or payload.get('edit_id') or payload.get('record_id')
            registro_existente = None

            if target_id:
                registro_existente = db.session.query(FormularioNutricion).filter_by(id=str(target_id)).first()

            if registro_existente:
                # Modificacion Segura (OWASP A01)
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
                registro_existente.nombre_nutricionista = raw_nombre_nutri
                registro_existente.registro_profesional = clean_reg_prof
                registro_existente.nombre_jefe_hogar = str(
                    payload.get('nombre_jefe', payload.get('nombre_jefe_hogar', ''))).strip()
                registro_existente.doc_identidad = str(payload.get('doc_identidad', '')).strip()
                registro_existente.telefono_contacto = clean_telefono
                registro_existente.total_integrantes = total_integrantes
                registro_existente.familia_visita_no = str(payload.get('visita_no', '')).strip()
                registro_existente.antropometria = payload.get('antropometria', [])
                registro_existente.seguridad_alimentaria = legacy_seguridad_json
                registro_existente.plan_cuidado = legacy_plan_cuidado_json
                registro_existente.seguimiento = payload.get('seguimiento', {})
                registro_existente.acc_disp = acc_disp
                registro_existente.consumo = consumo
                registro_existente.hfias = hfias
                registro_existente.lineas_accion = lineas_accion
                registro_existente.lineas_otra = lineas_otra
                registro_existente.compromiso = compromiso
                registro_existente.remite = remite_bool
                registro_existente.cc_profesional = str(payload.get('cc_profesional', '')).strip()
                registro_existente.cc_cuidador = str(payload.get('cc_cuidador', '')).strip()

                if payload.get('firma_profesional'):
                    registro_existente.firma_profesional = str(payload.get('firma_profesional')).strip()
                if payload.get('firma_cuidador'):
                    registro_existente.firma_cuidador = str(payload.get('firma_cuidador')).strip()

                registro_existente.synced_at = datetime.utcnow()
                db.session.commit()

                print(f"[NUTRICION SERVICE] Expediente {target_id} actualizado exitosamente sin duplicacion.")
                return {
                    "status": "success",
                    "message": f"Expediente Nutricion {target_id} actualizado correctamente.",
                    "id": str(target_id),
                    "code": 200
                }
            else:
                new_record_id = str(uuid.uuid4())
                nuevo_registro = FormularioNutricion(
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
                    nombre_nutricionista=raw_nombre_nutri,
                    registro_profesional=clean_reg_prof,
                    nombre_jefe_hogar=str(payload.get('nombre_jefe', payload.get('nombre_jefe_hogar', ''))).strip(),
                    doc_identidad=str(payload.get('doc_identidad', '')).strip(),
                    telefono_contacto=clean_telefono,
                    total_integrantes=total_integrantes,
                    familia_visita_no=str(payload.get('visita_no', '')).strip(),
                    antropometria=payload.get('antropometria', []),
                    seguridad_alimentaria=legacy_seguridad_json,
                    plan_cuidado=legacy_plan_cuidado_json,
                    seguimiento=payload.get('seguimiento', {}),
                    acc_disp=acc_disp,
                    consumo=consumo,
                    hfias=hfias,
                    lineas_accion=lineas_accion,
                    lineas_otra=lineas_otra,
                    compromiso=compromiso,
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

                print(f"[NUTRICION SERVICE] Nuevo expediente {new_record_id} creado exitosamente.")
                return {
                    "status": "success",
                    "message": f"Expediente Nutricion {new_record_id} creado exitosamente.",
                    "id": new_record_id,
                    "code": 200
                }

        except Exception as e:
            db.session.rollback()
            print(f"[NUTRICION SERVICE ERROR] Fallo DML: {str(e)}")
            return {
                "status": "error",
                "message": "Error DML al procesar la valoracion nutricional.",
                "code": 500
            }

    @classmethod
    def get_by_id(cls, form_id: str, user_data: dict) -> dict:
        try:
            formulario = db.session.query(FormularioNutricion).filter_by(id=str(form_id)).first()
            if not formulario or formulario.is_deleted:
                return {
                    "status": "error",
                    "message": "Expediente nutricional no encontrado.",
                    "code": 404
                }

            user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
            user_email = str(user_data.get('email', '')).strip().lower()

            if user_role not in ['ADMINISTRADOR',
                                 'COORDINADOR'] and formulario.especialista_email.lower() != user_email:
                return {
                    "status": "error",
                    "message": "Acceso denegado. Privilegios insuficientes.",
                    "code": 403
                }

            return {
                "status": "success",
                "data": formulario.to_dict(),
                "code": 200
            }
        except Exception as e:
            print(f"[NUTRICION SERVICE ERROR] Error consultando ID {form_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Fallo transaccional al consultar el expediente.",
                "code": 500
            }
