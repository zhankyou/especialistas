import csv
import io
from sqlalchemy import inspect, text
from src.models import db


class RegistrosService:
    """
    Capa de Dominio para la agregacion unificada de expedientes clinicos.
    Consolida las tablas fisicas de especialidad (fisioterapia, nutricionista, respiratoria)
    e inyecta la resolucion dinamica del nombre/email del Especialista.
    """

    @classmethod
    def _resolve_column(cls, existing_cols: set, candidate_list: list, default_value: str = "'N/A'") -> str:
        """
        Retorna la primera columna existente en la tabla o un valor por defecto tipo texto.
        """
        for candidate in candidate_list:
            if candidate.lower() in existing_cols:
                return f"COALESCE({candidate}::text, {default_value})"
        return f"{default_value}::text"

    @classmethod
    def _build_table_select(cls, table_name: str, modulo_name: str, existing_cols: set) -> str:
        """
        Construye la instruccion SELECT evaluando en cascada las columnas de identidad
        para garantizar que la celda Especialista nunca muestre 'sin asignar' de forma erronea.
        """
        visita_no_expr = cls._resolve_column(
            existing_cols,
            ['familia_visita_no', 'visita_no', 'no_visita', 'familia_visita'],
            "'01'"
        )
        codigo_fam_expr = cls._resolve_column(
            existing_cols,
            ['codigo_familia', 'cod_familia', 'familia_codigo'],
            "'N/A'"
        )
        jefe_expr = cls._resolve_column(
            existing_cols,
            ['nombre_jefe_hogar', 'nombre_jefe', 'nombre_jefe_familia', 'jefe_hogar'],
            "'N/A'"
        )
        doc_expr = cls._resolve_column(
            existing_cols,
            ['doc_identidad', 'doc_identidad_jefe', 'paciente_documento', 'documento'],
            "'00000000'"
        )

        # Construccion de la cascada de candidatos para identificar al especialista
        prof_candidates = []

        # 1. Columnas de Nombres Propios de Especialista
        for col in ['nombre_nutricionista', 'nombre_fisio', 'nombre_profesional']:
            if col in existing_cols:
                prof_candidates.append(
                    f"NULLIF(NULLIF(NULLIF(NULLIF(TRIM(LOWER({col}::text)), 'sin asignar'), 'sin_asignar'), 'n/a'), '')"
                )

        # 2. Columnas de Correo Electronico como Respaldo Seguro (Fallback)
        for col in ['especialista_email', 'profesional_email', 'email']:
            if col in existing_cols:
                prof_candidates.append(
                    f"NULLIF(NULLIF(TRIM(LOWER({col}::text)), 'sin asignar'), '')"
                )

        if prof_candidates:
            prof_expr = f"COALESCE({', '.join(prof_candidates)}, 'sin asignar')"
        else:
            prof_expr = "'sin asignar'"

        fecha_expr = cls._resolve_column(
            existing_cols,
            ['fecha_visita', 'created_at', 'fecha'],
            "NOW()::text"
        )

        deleted_expr = "COALESCE(is_deleted, false)" if 'is_deleted' in existing_cols else "false"
        created_expr = "COALESCE(created_at, NOW())" if 'created_at' in existing_cols else "NOW()"

        return f"""
            SELECT 
                id::text AS id,
                '{modulo_name}' AS modulo,
                {visita_no_expr} AS familia_visita_no,
                {codigo_fam_expr} AS codigo_familia,
                {jefe_expr} AS nombre_jefe_hogar,
                {doc_expr} AS doc_identidad,
                {prof_expr} AS especialista_email,
                {fecha_expr} AS fecha_visita,
                {deleted_expr} AS is_deleted,
                {created_expr} AS created_at
            FROM {table_name}
        """

    @classmethod
    def get_all_records(cls, user_data: dict, is_deleted: bool = False, search_query: str = ""):
        user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
        user_email = str(user_data.get('email', '')).strip().lower()

        inspector = inspect(db.engine)
        select_blocks = []

        table_map = [
            ('formulario_nutricionista', 'nutricion'),
            ('formulario_fisioterapia', 'fisioterapia'),
            ('formulario_respiratoria', 'respiratoria'),
            ('registros_aps', 'general')
        ]

        for table_name, modulo_name in table_map:
            if inspector.has_table(table_name):
                cols = {c['name'].lower() for c in inspector.get_columns(table_name)}
                select_blocks.append(cls._build_table_select(table_name, modulo_name, cols))

        if not select_blocks:
            return {"status": "success", "count": 0, "data": [], "code": 200}

        union_query = "\n UNION ALL \n".join(select_blocks)

        sql_text = f"""
            WITH unificados AS (
                {union_query}
            ),
            deduplicados AS (
                SELECT DISTINCT ON (id) *
                FROM unificados
                ORDER BY id, created_at DESC
            )
            SELECT * FROM deduplicados
            WHERE is_deleted = :is_deleted
        """

        params = {"is_deleted": is_deleted}

        if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
            sql_text += " AND especialista_email = :user_email"
            params["user_email"] = user_email

        if search_query:
            sql_text += """ AND (
                doc_identidad ILIKE :search OR 
                nombre_jefe_hogar ILIKE :search OR 
                codigo_familia ILIKE :search OR 
                familia_visita_no ILIKE :search OR 
                especialista_email ILIKE :search OR 
                modulo ILIKE :search
            )"""
            params["search"] = f"%{search_query}%"

        sql_text += " ORDER BY created_at DESC"

        try:
            with db.engine.connect() as conn:
                result = conn.execute(text(sql_text), params).mappings().all()
                data_list = [dict(row) for row in result]

            return {"status": "success", "count": len(data_list), "data": data_list, "code": 200}
        except Exception as e:
            print(f"[DATA SERVICE ERROR] Fallo al consolidar registros unificados: {str(e)}")
            return {"status": "error", "message": "Error al consultar la base de datos distribuida.", "code": 500}

    @classmethod
    def get_record_detail(cls, modulo: str, record_id: str, user_data: dict):
        table_mapping = {
            'nutricion': 'formulario_nutricionista',
            'fisioterapia': 'formulario_fisioterapia',
            'respiratoria': 'formulario_respiratoria',
            'general': 'registros_aps'
        }

        target_table = table_mapping.get(str(modulo).lower())
        if not target_table:
            return {"status": "error", "message": "Modulo de especialidad invalido.", "code": 400}

        inspector = inspect(db.engine)
        if not inspector.has_table(target_table):
            return {"status": "error", "message": "Tabla de especialidad no encontrada.", "code": 404}

        sql_text = f"SELECT * FROM {target_table} WHERE id::text = :id"

        try:
            with db.engine.connect() as conn:
                row = conn.execute(text(sql_text), {"id": record_id}).mappings().first()
                if not row:
                    return {"status": "error", "message": "Expediente no encontrado.", "code": 404}

                record_data = dict(row)
                for key, val in record_data.items():
                    if hasattr(val, 'isoformat'):
                        record_data[key] = val.isoformat()

                return {"status": "success", "data": record_data, "modulo": modulo, "code": 200}
        except Exception as e:
            print(f"[DATA SERVICE ERROR] Error consultando detalle de expediente: {str(e)}")
            return {"status": "error", "message": "Fallo al extraer el detalle del formulario.", "code": 500}

    @classmethod
    def soft_delete_record(cls, record_id: str, user_data: dict):
        user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
        user_email = str(user_data.get('email', '')).strip().lower()

        tables = ['formulario_nutricionista', 'formulario_fisioterapia', 'formulario_respiratoria', 'registros_aps']
        mutations = 0

        try:
            with db.engine.begin() as conn:
                for table in tables:
                    if user_role in ['ADMINISTRADOR', 'COORDINADOR']:
                        query = text(f"UPDATE {table} SET is_deleted = true WHERE id::text = :id")
                        res = conn.execute(query, {"id": record_id})
                    else:
                        query = text(f"""
                            UPDATE {table} SET is_deleted = true 
                            WHERE id::text = :id AND (
                                LOWER(COALESCE(nombre_nutricionista, '')) = :email OR 
                                LOWER(COALESCE(nombre_fisio, '')) = :email OR 
                                LOWER(COALESCE(nombre_profesional, '')) = :email OR 
                                LOWER(COALESCE(especialista_email, '')) = :email OR
                                LOWER(COALESCE(profesional_email, '')) = :email
                            )
                        """)
                        res = conn.execute(query, {"id": record_id, "email": user_email})
                    mutations += res.rowcount

            if mutations > 0:
                return {"status": "success", "message": "Expediente trasladado a la papelera.", "code": 200}
            return {"status": "error", "message": "Registro no encontrado o privilegios insuficientes.", "code": 404}
        except Exception as e:
            print(f"[DATA SERVICE ERROR] Fallo al aplicar borrado logico: {str(e)}")
            return {"status": "error", "message": "Fallo al modificar el estado del expediente.", "code": 500}

    @classmethod
    def restore_record(cls, record_id: str, user_data: dict):
        user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
        if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
            return {"status": "error", "message": "Privilegios insuficientes para restaurar expedientes.", "code": 403}

        tables = ['formulario_nutricionista', 'formulario_fisioterapia', 'formulario_respiratoria', 'registros_aps']
        mutations = 0

        try:
            with db.engine.begin() as conn:
                for table in tables:
                    query = text(f"UPDATE {table} SET is_deleted = false WHERE id::text = :id")
                    res = conn.execute(query, {"id": record_id})
                    mutations += res.rowcount

            if mutations > 0:
                return {"status": "success", "message": "Expediente restaurado exitosamente.", "code": 200}
            return {"status": "error", "message": "Registro no encontrado en la papelera.", "code": 404}
        except Exception as e:
            print(f"[DATA SERVICE ERROR] Fallo al restaurar expediente: {str(e)}")
            return {"status": "error", "message": "Error transaccional durante la restauracion.", "code": 500}

    @classmethod
    def export_csv(cls, user_data: dict, filter_type: str, p1: str, p2: str):
        records_resp = cls.get_all_records(user_data, is_deleted=False, search_query="")
        if records_resp["status"] != "success":
            return None

        records = records_resp["data"]
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        writer.writerow(['ID', 'Modulo', 'Familia Visita No', 'Codigo Familia', 'Jefe de Hogar', 'Documento Identidad',
                         'Especialista', 'Fecha Visita'])

        for r in records:
            writer.writerow([
                r.get('id'),
                r.get('modulo'),
                r.get('familia_visita_no'),
                r.get('codigo_familia'),
                r.get('nombre_jefe_hogar'),
                r.get('doc_identidad'),
                r.get('especialista_email'),
                r.get('fecha_visita')
            ])

        return output.getvalue()
