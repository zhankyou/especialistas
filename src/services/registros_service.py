import io
import csv
from sqlalchemy import text
from src.models import db


class RegistrosService:
    @staticmethod
    def get_registros(is_deleted=False, search_term="", user_email=None, user_role=None):
        """
        Consulta la vista unificada de expedientes aplicando Row-Level Access Control (RLAC).
        ADMINISTRADOR / COORDINADOR: Ven toda la base de datos.
        DILIGENCIADOR: Solo visualiza sus propios registros (activos o eliminados).
        """
        try:
            search_param = f"%{search_term}%" if search_term else "%"
            query_params = {
                "is_deleted": is_deleted,
                "search": search_param
            }

            rbac_clause = ""
            if user_role == 'DILIGENCIADOR':
                rbac_clause = " AND especialista_email = :user_email"
                query_params['user_email'] = user_email

            sql_query = text(f"""
                WITH expedientes AS (
                    SELECT id,
                           especialista_email,
                           fecha_visita,
                           codigo_familia,
                           nombre_jefe_hogar,
                           doc_identidad,
                           'nutricion' as modulo,
                           is_deleted,
                           created_at
                    FROM formulario_nutricionista
                    UNION ALL
                    SELECT id,
                           especialista_email,
                           fecha_visita,
                           codigo_familia,
                           nombre_jefe_hogar,
                           doc_identidad,
                           'respiratoria' as modulo,
                           is_deleted,
                           created_at
                    FROM formulario_respiratoria
                    UNION ALL
                    SELECT id,
                           especialista_email,
                           fecha_visita,
                           codigo_familia,
                           nombre_jefe_hogar,
                           doc_identidad,
                           'fisioterapia' as modulo,
                           is_deleted,
                           created_at
                    FROM formulario_fisioterapia
                )
                SELECT id,
                       especialista_email,
                       fecha_visita,
                       codigo_familia,
                       nombre_jefe_hogar,
                       doc_identidad,
                       modulo,
                       created_at
                FROM expedientes
                WHERE is_deleted = :is_deleted
                  {rbac_clause}
                  AND (
                      id ILIKE :search
                      OR codigo_familia ILIKE :search
                      OR nombre_jefe_hogar ILIKE :search
                      OR doc_identidad ILIKE :search
                  )
                ORDER BY created_at DESC;
            """)

            result = db.session.execute(sql_query, query_params)
            records = []
            for row in result:
                records.append({
                    "id": str(row.id),
                    "especialista_email": row.especialista_email,
                    "fecha_visita": str(row.fecha_visita) if row.fecha_visita else None,
                    "codigo_familia": row.codigo_familia,
                    "nombre_jefe_hogar": row.nombre_jefe_hogar,
                    "doc_identidad": row.doc_identidad,
                    "modulo": row.modulo,
                    "created_at": str(row.created_at) if row.created_at else None
                })
            return {"status": "success", "data": records, "code": 200}
        except Exception as e:
            print(f"Error DQL Gestor Registros: {str(e)}")
            return {"status": "error", "message": "Fallo al consultar expedientes.", "code": 500}

    @staticmethod
    def toggle_soft_delete(record_id, modulo, is_deleted_flag, user_email=None, user_role=None):
        """
        Aplica Soft Delete a un registro. Valida la propiedad del registro si la solicitud proviene de un DILIGENCIADOR.
        """
        try:
            table_map = {
                "nutricion": "formulario_nutricionista",
                "respiratoria": "formulario_respiratoria",
                "fisioterapia": "formulario_fisioterapia"
            }
            table_name = table_map.get(modulo)
            if not table_name:
                return {"status": "error", "message": "Modulo no reconocido.", "code": 400}

            # Validación de Propiedad para DILIGENCIADOR (Prevención IDOR)
            if user_role == 'DILIGENCIADOR':
                sql_check = text(f"SELECT especialista_email FROM {table_name} WHERE id = :id")
                check_res = db.session.execute(sql_check, {"id": record_id}).fetchone()

                if not check_res:
                    return {"status": "error", "message": "Expediente no encontrado.", "code": 404}
                if check_res.especialista_email != user_email:
                    return {"status": "error", "message": "No posee permisos para modificar este expediente.", "code": 403}

            sql_update = text(f"UPDATE {table_name} SET is_deleted = :flag WHERE id = :id")
            db.session.execute(sql_update, {"flag": is_deleted_flag, "id": record_id})
            db.session.commit()
            return {"status": "success", "message": "Estado actualizado.", "code": 200}
        except Exception as e:
            db.session.rollback()
            print(f"Error DML Soft-Delete: {str(e)}")
            return {"status": "error", "message": "Error al modificar expediente.", "code": 500}

    @staticmethod
    def get_registro_detalle(record_id, modulo, user_email=None, user_role=None):
        """
        Extrae la información completa de un expediente validando autorización según el rol.
        """
        try:
            record = None
            if modulo == 'nutricion':
                from src.models.nutricion_model import FormularioNutricion
                record = db.session.get(FormularioNutricion, record_id)
            elif modulo == 'respiratoria':
                from src.models.respiratoria_model import FormularioRespiratoria
                record = db.session.get(FormularioRespiratoria, record_id)
            elif modulo == 'fisioterapia':
                from src.models.fisioterapia_model import FormularioFisioterapia
                record = db.session.get(FormularioFisioterapia, record_id)
            else:
                return {"status": "error", "message": "Modulo invalido.", "code": 400}

            if not record:
                return {"status": "error", "message": "Expediente no encontrado.", "code": 404}

            # Validación de Dominio para DILIGENCIADOR
            if user_role == 'DILIGENCIADOR' and record.especialista_email != user_email:
                return {"status": "error", "message": "Acceso denegado a los detalles de este expediente.", "code": 403}

            data_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
            if 'fecha_visita' in data_dict and data_dict['fecha_visita']:
                data_dict['fecha_visita'] = str(data_dict['fecha_visita'])
            if 'created_at' in data_dict and data_dict['created_at']:
                data_dict['created_at'] = str(data_dict['created_at'])
            if 'synced_at' in data_dict and data_dict['synced_at']:
                data_dict['synced_at'] = str(data_dict['synced_at'])

            return {"status": "success", "data": data_dict, "code": 200}
        except Exception as e:
            print(f"Error DQL Detalles: {str(e)}")
            return {"status": "error", "message": "Error interno extrayendo detalle.", "code": 500}

    @staticmethod
    def exportar_expedientes_csv(filtro_tipo, param1, param2=None, user_email=None, user_role=None):
        """
        Genera un buffer CSV en memoria aplicando el filtro por rol RLAC.
        """
        try:
            base_sql = """
                WITH data_export AS (
                    SELECT id, especialista_email, fecha_visita, territorio, microterritorio, codigo_familia,
                           municipio, barrio, direccion, latitud, longitud, registro_profesional, nombre_jefe_hogar,
                           doc_identidad, telefono_contacto, total_integrantes, familia_visita_no,
                           'NUTRICIÓN' as especialidad, is_deleted, created_at
                    FROM formulario_nutricionista
                    UNION ALL
                    SELECT id, especialista_email, fecha_visita, territorio, microterritorio, codigo_familia,
                           municipio, barrio, direccion, latitud, longitud, registro_profesional, nombre_jefe_hogar,
                           doc_identidad, telefono_contacto, total_integrantes, familia_visita_no,
                           'RESPIRATORIA' as especialidad, is_deleted, created_at
                    FROM formulario_respiratoria
                    UNION ALL
                    SELECT id, especialista_email, fecha_visita, territorio, microterritorio, codigo_familia,
                           municipio, barrio, direccion, latitud, longitud, registro_profesional, nombre_jefe_hogar,
                           doc_identidad, telefono_contacto, total_integrantes, familia_visita_no,
                           'FISIOTERAPIA' as especialidad, is_deleted, created_at
                    FROM formulario_fisioterapia
                )
                SELECT *
                FROM data_export
                WHERE is_deleted = FALSE
            """

            query_params = {}
            where_clause = ""

            # Filtro RLAC por Rol
            if user_role == 'DILIGENCIADOR':
                where_clause += " AND especialista_email = :user_email"
                query_params['user_email'] = user_email

            # Filtros dinámicos de interfaz
            if filtro_tipo == 'mes' and param1:
                where_clause += " AND TO_CHAR(fecha_visita, 'YYYY-MM') = :param1"
                query_params['param1'] = param1
            elif filtro_tipo == 'rango' and param1 and param2:
                where_clause += " AND fecha_visita >= :param1 AND fecha_visita <= :param2"
                query_params['param1'] = param1
                query_params['param2'] = param2
            elif filtro_tipo == 'especialista' and param1 and user_role != 'DILIGENCIADOR':
                where_clause += " AND especialista_email ILIKE :param1"
                query_params['param1'] = f"%{param1}%"
            elif filtro_tipo == 'especialidad' and param1:
                where_clause += " AND especialidad ILIKE :param1"
                query_params['param1'] = f"%{param1}%"

            sql_final = text(base_sql + where_clause + " ORDER BY created_at DESC;")
            result = db.session.execute(sql_final, query_params)

            output = io.StringIO()
            writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)

            headers = [
                "ID_Expediente", "Especialidad", "Fecha_Visita", "Email_Especialista", "Registro_Profesional",
                "Codigo_Familia", "Territorio", "Microterritorio", "Municipio", "Barrio", "Direccion",
                "Latitud", "Longitud", "Nombre_Jefe_Hogar", "Doc_Identidad", "Telefono", "Integrantes",
                "Visita_No", "Fecha_Creacion_Sistema"
            ]
            writer.writerow(headers)

            for row in result:
                writer.writerow([
                    row.id, row.especialidad, row.fecha_visita, row.especialista_email, row.registro_profesional,
                    row.codigo_familia, row.territorio, row.microterritorio, row.municipio, row.barrio, row.direccion,
                    row.latitud, row.longitud, row.nombre_jefe_hogar, row.doc_identidad, row.telefono_contacto,
                    row.total_integrantes, row.familia_visita_no, row.created_at
                ])

            return {"status": "success", "csv_data": output.getvalue(), "code": 200}
        except Exception as e:
            print(f"Error Generando CSV: {str(e)}")
            return {"status": "error", "message": "Fallo interno al procesar el archivo CSV.", "code": 500}