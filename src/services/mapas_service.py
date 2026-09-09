from sqlalchemy import text
from src.models import db


class MapasService:
    """
    Capa de Dominio Geoespacial.
    Consolida las coordenadas de los módulos clínicos, implementa autocompletado
    y aplica Control de Acceso Basado en Roles (RBAC).
    """

    @classmethod
    def get_geodata(cls, user_data: dict, filter_email: str = "") -> dict:
        try:
            user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
            user_email = str(user_data.get('email', '')).strip().lower()

            # Seguridad OWASP A01: Restriccion determinista de visibilidad
            if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
                filter_email = user_email

            tables = [
                ('formulario_fisioterapia', 'fisioterapia'),
                ('formulario_nutricionista', 'nutricion'),
                ('formulario_respiratoria', 'respiratoria')
            ]

            queries = []
            for table_name, modulo in tables:
                q = f"""
                    SELECT 
                        id::text AS id, 
                        '{modulo}' AS modulo, 
                        latitud::text, 
                        longitud::text, 
                        especialista_email::text, 
                        codigo_familia::text, 
                        fecha_visita::text
                    FROM {table_name}
                    WHERE COALESCE(is_deleted, false) = false 
                      AND latitud IS NOT NULL AND TRIM(latitud::text) != '' 
                      AND longitud IS NOT NULL AND TRIM(longitud::text) != ''
                """
                queries.append(q)

            union_query = "\n UNION ALL \n".join(queries)

            final_query = f"SELECT * FROM ({union_query}) AS geo_data"
            params = {}

            if filter_email:
                final_query += " WHERE especialista_email ILIKE :email"
                params['email'] = f"%{filter_email.strip()}%"

            final_query += " ORDER BY fecha_visita DESC"

            with db.engine.connect() as conn:
                result = conn.execute(text(final_query), params).mappings().all()
                data_list = [dict(row) for row in result]

            return {
                "status": "success",
                "count": len(data_list),
                "data": data_list,
                "code": 200
            }

        except Exception as e:
            print(f"[GEO SERVICE ERROR] Fallo al consolidar puntos geograficos: {str(e)}")
            return {
                "status": "error",
                "message": "Error interno al consultar las coordenadas en la Base de Datos.",
                "code": 500
            }

    @classmethod
    def get_unique_emails(cls, user_data: dict) -> dict:
        """
        Extrae un listado unico de todos los correos institucionales registrados en el sistema
        para nutrir el motor de autocompletado en el frontend.
        """
        try:
            user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
            user_email = str(user_data.get('email', '')).strip().lower()

            if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
                return {"status": "success", "data": [user_email], "code": 200}

            sql = "SELECT DISTINCT LOWER(TRIM(email)) FROM especialista WHERE is_active = true ORDER BY 1"

            with db.engine.connect() as conn:
                result = conn.execute(text(sql)).fetchall()
                emails = [row[0] for row in result if row[0]]

            return {"status": "success", "data": emails, "code": 200}

        except Exception as e:
            print(f"[GEO SERVICE ERROR] Fallo al consultar correos para autocompletado: {str(e)}")
            return {"status": "error", "message": "Fallo al procesar listado de correos.", "code": 500}
