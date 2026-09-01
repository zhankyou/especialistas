import csv
import io
import json
import zipfile
from datetime import datetime
from sqlalchemy import inspect, text
from src.models import db


class RegistrosService:
    """
    Capa de Dominio para la agregacion unificada de expedientes clinicos y
    motor avanzado de exportacion CSV/ZIP basado en Reflexion de Esquema (DDL).
    """

    @classmethod
    def _resolve_column(cls, existing_cols: set, candidate_list: list, default_value: str = "'N/A'") -> str:
        for candidate in candidate_list:
            if candidate.lower() in existing_cols:
                return f"COALESCE({candidate}::text, {default_value})"
        return f"{default_value}::text"

    @classmethod
    def _build_table_select(cls, table_name: str, modulo_name: str, existing_cols: set) -> str:
        visita_no_expr = cls._resolve_column(existing_cols, ['familia_visita_no', 'visita_no', 'no_visita', 'familia_visita'], "'01'")
        codigo_fam_expr = cls._resolve_column(existing_cols, ['codigo_familia', 'cod_familia', 'familia_codigo'], "'N/A'")
        jefe_expr = cls._resolve_column(existing_cols, ['nombre_jefe_hogar', 'nombre_jefe', 'nombre_jefe_familia', 'jefe_hogar'], "'N/A'")
        doc_expr = cls._resolve_column(existing_cols, ['doc_identidad', 'doc_identidad_jefe', 'paciente_documento', 'documento'], "'00000000'")

        # Extraccion del Nombre del Profesional digitado en el formulario
        prof_candidates = []
        for col in ['nombre_nutricionista', 'nombre_fisio', 'nombre_fisioterapeuta', 'nombre_profesional']:
            if col in existing_cols:
                prof_candidates.append(f"NULLIF(NULLIF(NULLIF(NULLIF(TRIM(LOWER({col}::text)), 'sin asignar'), 'sin_asignar'), 'n/a'), '')")

        nombre_prof_expr = f"COALESCE({', '.join(prof_candidates)}, 'Sin Nombre')" if prof_candidates else "'Sin Nombre'"

        # Extraccion Inmutable del Correo Electronico del Especialista
        email_expr = "especialista_email::text" if 'especialista_email' in existing_cols else "'Sin Correo'"

        fecha_expr = cls._resolve_column(existing_cols, ['fecha_visita', 'created_at', 'fecha'], "NOW()::text")
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
                {email_expr} AS especialista_email,
                {nombre_prof_expr} AS nombre_especialista,
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
            WITH unificados AS ({union_query}),
            deduplicados AS (SELECT DISTINCT ON (id) * FROM unificados ORDER BY id, created_at DESC)
            SELECT * FROM deduplicados WHERE is_deleted = :is_deleted
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
                nombre_especialista ILIKE :search OR
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
            print(f"[DATA SERVICE ERROR] Fallo al consolidar registros: {str(e)}")
            return {"status": "error", "message": "Error al consultar la base de datos.", "code": 500}

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
            print(f"[DATA SERVICE ERROR] Error consultando detalle: {str(e)}")
            return {"status": "error", "message": "Fallo al extraer el detalle.", "code": 500}

    @classmethod
    def soft_delete_record(cls, record_id: str, user_data: dict):
        user_role = str(user_data.get('rol', '')).strip().upper()
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
                        query = text(f"UPDATE {table} SET is_deleted = true WHERE id::text = :id AND LOWER(COALESCE(especialista_email, '')) = :email")
                        res = conn.execute(query, {"id": record_id, "email": user_email})
                    mutations += res.rowcount
            if mutations > 0:
                return {"status": "success", "message": "Expediente trasladado a la papelera.", "code": 200}
            return {"status": "error", "message": "Registro no encontrado o privilegios insuficientes.", "code": 404}
        except Exception as e:
            print(f"[DATA SERVICE ERROR] Fallo al aplicar borrado: {str(e)}")
            return {"status": "error", "message": "Fallo al modificar el estado.", "code": 500}

    @classmethod
    def restore_record(cls, record_id: str, user_data: dict):
        user_role = str(user_data.get('rol', '')).strip().upper()
        if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
            return {"status": "error", "message": "Privilegios insuficientes.", "code": 403}

        tables = ['formulario_nutricionista', 'formulario_fisioterapia', 'formulario_respiratoria', 'registros_aps']
        mutations = 0
        try:
            with db.engine.begin() as conn:
                for table in tables:
                    query = text(f"UPDATE {table} SET is_deleted = false WHERE id::text = :id")
                    res = conn.execute(query, {"id": record_id})
                    mutations += res.rowcount
            if mutations > 0:
                return {"status": "success", "message": "Expediente restaurado.", "code": 200}
            return {"status": "error", "message": "Registro no encontrado.", "code": 404}
        except Exception as e:
            print(f"[DATA SERVICE ERROR] Fallo al restaurar: {str(e)}")
            return {"status": "error", "message": "Error transaccional.", "code": 500}

    @classmethod
    def _sanitize_csv_value(cls, key: str, val) -> str:
        if val is None:
            return ""
        key_lower = str(key).lower()
        val_str = str(val)
        if 'firma' in key_lower or val_str.startswith('data:image/'):
            return "FIRMA REGISTRADA" if len(val_str) > 50 else "NO REGISTRADA"
        if isinstance(val, (dict, list)):
            return json.dumps(val, ensure_ascii=False)
        if hasattr(val, 'isoformat'):
            return val.isoformat()
        return val_str.replace('\n', ' ').replace('\r', '').strip()

    @classmethod
    def _generate_csv_for_table(cls, table_name: str, user_data: dict, filter_type: str, p1: str, p2: str) -> tuple:
        user_role = str(user_data.get('rol', '')).strip().upper()
        user_email = str(user_data.get('email', '')).strip().lower()

        inspector = inspect(db.engine)
        if not inspector.has_table(table_name):
            return None, 0

        cols_names = [c['name'] for c in inspector.get_columns(table_name)]
        sql_text = f"SELECT * FROM {table_name} WHERE COALESCE(is_deleted, false) = false"
        params = {}

        if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
            if 'especialista_email' in cols_names:
                sql_text += " AND LOWER(COALESCE(especialista_email::text, '')) = :email"
                params["email"] = user_email
            else:
                sql_text += " AND 1=0"

        if filter_type == 'mes' and p1:
            sql_text += " AND TO_CHAR(fecha_visita, 'YYYY-MM') = :p1"
            params['p1'] = p1
        elif filter_type == 'rango' and p1 and p2:
            sql_text += " AND fecha_visita BETWEEN :p1 AND :p2"
            params['p1'] = p1
            params['p2'] = p2
        elif filter_type == 'especialista' and p1:
            if 'especialista_email' in cols_names:
                sql_text += " AND LOWER(COALESCE(especialista_email::text, '')) = LOWER(:search_email)"
                params['search_email'] = str(p1).strip()

        sql_text += " ORDER BY created_at DESC"

        with db.engine.connect() as conn:
            rows = conn.execute(text(sql_text), params).mappings().all()

        if not rows:
            return None, 0

        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)
        writer.writerow(cols_names)

        for row in rows:
            row_dict = dict(row)
            writer.writerow([cls._sanitize_csv_value(col, row_dict.get(col)) for col in cols_names])

        return output.getvalue().encode('utf-8'), len(rows)

    @classmethod
    def export_csv(cls, user_data: dict, filter_type: str, p1: str, p2: str) -> tuple:
        table_map = {
            'nutricion': ('formulario_nutricionista', 'APS_Base_Nutricion'),
            'fisioterapia': ('formulario_fisioterapia', 'APS_Base_Fisioterapia'),
            'respiratoria': ('formulario_respiratoria', 'APS_Base_Respiratoria')
        }
        filter_key = str(filter_type).strip().lower()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M')

        if filter_key == 'especialidad' and p1 and p1.lower() in table_map:
            t_name, f_prefix = table_map[p1.lower()]
            csv_bytes, count = cls._generate_csv_for_table(t_name, user_data, filter_type, p1, p2)
            if csv_bytes and count > 0:
                return csv_bytes, f"{f_prefix}_{timestamp}.csv", "text/csv"
            return None, "No se encontraron registros para la especialidad seleccionada.", "error"

        zip_buffer = io.BytesIO()
        total_exported = 0

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for key, (t_name, f_prefix) in table_map.items():
                csv_bytes, count = cls._generate_csv_for_table(t_name, user_data, filter_type, p1, p2)
                if csv_bytes and count > 0:
                    zip_file.writestr(f"{f_prefix}_{timestamp}.csv", csv_bytes)
                    total_exported += count

        if total_exported == 0:
            return None, "No se encontraron registros bajo los parametros de filtro indicados.", "error"

        zip_buffer.seek(0)
        return zip_buffer.getvalue(), f"APS_Exportacion_Total_{timestamp}.zip", "application/zip"
