import os
import importlib
import pkgutil
import re
from flask import Flask, redirect, url_for, render_template, request, Blueprint
from sqlalchemy import inspect, text
from config.settings import Config
from src.models import db


def auto_repair_database_schema(app_instance):
    """
    Motor de auto-reparacion DDL.
    Asegura que el Indice Maestro (registros_aps) tenga la misma topologia estructural
    requerida por el Frontend SPA.
    """
    with app_instance.app_context():
        try:
            inspector = inspect(db.engine)

            # 1. Validacion Tabla Especialistas
            table_especialista = 'especialista'
            if inspector.has_table(table_especialista):
                existing_columns = [col['name'] for col in inspector.get_columns(table_especialista)]
                required_columns = {
                    'nombre': "VARCHAR(150) DEFAULT 'Profesional APS'",
                    'is_active': 'BOOLEAN DEFAULT TRUE',
                    'is_blocked': 'BOOLEAN DEFAULT FALSE',
                    'failed_login_attempts': 'INTEGER DEFAULT 0',
                    'account_locked_until': 'TIMESTAMP',
                    'last_login_at': 'TIMESTAMP',
                    'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                    'updated_at': 'TIMESTAMP'
                }

                with db.engine.connect() as conn:
                    for col_name, col_definition in required_columns.items():
                        if col_name not in existing_columns:
                            print(f"[AUTO-REPAIR CLOUD] Inyectando columna {col_name} en {table_especialista}")
                            conn.execute(text(f"ALTER TABLE {table_especialista} ADD COLUMN {col_name} {col_definition};"))
                    conn.commit()

            # 2. Validacion Indice Maestro (registros_aps)
            table_registros = 'registros_aps'
            if inspector.has_table(table_registros):
                existing_cols_reg = [col['name'] for col in inspector.get_columns(table_registros)]
                required_cols_reg = {
                    'modulo': "VARCHAR(50) DEFAULT 'general'",
                    'codigo_familia': "VARCHAR(50) DEFAULT 'N/A'",
                    'nombre_jefe_hogar': "VARCHAR(150) DEFAULT 'N/A'",
                    'doc_identidad': "VARCHAR(50) DEFAULT '00000000'",
                    'especialista_email': "VARCHAR(150) DEFAULT 'N/A'",
                    'fecha_visita': "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                    'is_deleted': "BOOLEAN DEFAULT FALSE NOT NULL"
                }
                with db.engine.connect() as conn:
                    for c_name, c_def in required_cols_reg.items():
                        if c_name not in existing_cols_reg:
                            print(f"[AUTO-REPAIR CLOUD] Inyectando atributo: {c_name} en {table_registros}")
                            conn.execute(text(f"ALTER TABLE {table_registros} ADD COLUMN {c_name} {c_def};"))
                    conn.commit()

            db.create_all()
            print("[AUTO-REPAIR SUCCESS] Estructuras validadas en PostgreSQL Aiven.")

        except Exception as e:
            print(f"[CRITICAL DB ERROR] Fallo de comunicacion con Aiven Cloud: {str(e)}")


def auto_discover_blueprints(app_instance):
    """Auto-Discovery de Controladores (SOLID: Open/Closed Principle)"""
    import src.controllers

    print("[ROUTER INIT] Iniciando escaneo de controladores API...")

    for _, module_name, _ in pkgutil.iter_modules(src.controllers.__path__):
        try:
            module = importlib.import_module(f'src.controllers.{module_name}')
            for attribute_name in dir(module):
                attribute = getattr(module, attribute_name)
                if isinstance(attribute, Blueprint):
                    if attribute.name not in app_instance.blueprints:
                        app_instance.register_blueprint(attribute)
                        print(f"[ROUTER SUCCESS] Endpoint montado exitosamente: {attribute.name}")
        except Exception as e:
            print(f"[ROUTER WARNING] No se pudo acoplar el modulo {module_name}: {str(e)}")


def create_app():
    """Application Factory Architecture"""
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.config.from_object(Config)

    db.init_app(app)
    auto_discover_blueprints(app)
    auto_repair_database_schema(app)

    # -------------------------------------------------------------------------
    # MIDDLEWARE ARQUITECTÓNICO DE SINCRONIZACIÓN PROFUNDA (INTERCEPTOR)
    # -------------------------------------------------------------------------
    @app.after_request
    def sync_master_record(response):
        """
        Escucha peticiones de guardado exitosas. Extrae el UUID generado
        y consulta DIRECTAMENTE la tabla de la especialidad correspondiente 
        para poblar el Indice Maestro (registros_aps) sin depender del Payload HTTP.
        """
        if request.method == 'POST' and '/save' in request.path and response.status_code == 200:
            try:
                # Determinar modulo de la URL (Ej: '/api/nutricion/save' -> 'nutricion')
                path_parts = request.path.strip('/').split('/')
                modulo = None
                for m in ['nutricion', 'fisioterapia', 'respiratoria']:
                    if m in path_parts:
                        modulo = m
                        break

                if modulo:
                    # Extraer el UUID de la respuesta (usualmente el backend devuelve el ID creado)
                    res_text = response.get_data(as_text=True)
                    match = re.search(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', res_text)
                    record_id = match.group(1) if match else None

                    if record_id:
                        from src.models import db
                        from src.models.registro_model import RegistroAPS
                        from src.utils.auth_utils import get_user_from_request
                        
                        user_data = get_user_from_request(request) or {}
                        especialista_email = user_data.get('email', 'SISTEMA')

                        # Evitar duplicados en el indice maestro
                        exists = db.session.query(RegistroAPS).filter_by(id=record_id).first()
                        
                        if not exists:
                            # MAPEO DINAMICO DE TABLAS SECUNDARIAS
                            tabla_origen = ""
                            if modulo == 'nutricion':
                                tabla_origen = "formulario_nutricionista"
                            elif modulo == 'fisioterapia':
                                tabla_origen = "formulario_fisioterapia"
                            elif modulo == 'respiratoria':
                                tabla_origen = "formulario_respiratoria"

                            # Extraccion SQL Nativa desde la tabla origen
                            sql_query = text(f"SELECT codigo_familia, nombre_jefe_hogar, doc_identidad FROM {tabla_origen} WHERE id = :record_id")
                            
                            with db.engine.connect() as conn:
                                result = conn.execute(sql_query, {"record_id": record_id}).mappings().first()
                                
                                if result:
                                    nuevo_registro = RegistroAPS(
                                        id=record_id,
                                        modulo=modulo,
                                        codigo_familia=result.get('codigo_familia', 'N/A'),
                                        nombre_jefe_hogar=result.get('nombre_jefe_hogar', 'N/A'),
                                        doc_identidad=result.get('doc_identidad', '00000000'),
                                        especialista_email=especialista_email
                                    )
                                    db.session.add(nuevo_registro)
                                    db.session.commit()
                                    print(f"[SYNC SUCCESS] Indice Maestro consolidado para ID: {record_id}")
                                else:
                                    print(f"[SYNC WARNING] El ID {record_id} no se encontro en {tabla_origen}.")
            except Exception as e:
                print(f"[SYNC CRITICAL ERROR] Falla en el Middleware Interceptor: {str(e)}")
                from src.models import db
                db.session.rollback()
                
        return response

    # -------------------------------------------------------------------------
    # ENRUTADOR MAESTRO DE VISTAS FRONTEND (SPA RENDERING)
    # -------------------------------------------------------------------------
    @app.route('/')
    def index():
        return redirect(url_for('login_page'))

    @app.route('/login')
    def login_page():
        return render_template('login.html')

    @app.route('/dashboard')
    def dashboard_page():
        return render_template('dashboard.html')

    @app.route('/usuarios')
    def usuarios_page():
        return render_template('usuarios.html')

    @app.route('/registros')
    def registros_page():
        return render_template('registros.html')

    @app.route('/nuevo_registro')
    def nuevo_registro_page():
        return render_template('nuevo_registro.html')

    @app.route('/sincronizacion')
    def sincronizacion_page():
        return render_template('sincronizacion.html')

    @app.route('/nutricion')
    def nutricion_page():
        return render_template('nutricion.html')

    @app.route('/respiratoria')
    def respiratoria_page():
        return render_template('respiratoria.html')

    @app.route('/fisioterapia')
    def fisioterapia_page():
        return render_template('fisioterapia.html')

    @app.after_request
    def apply_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        if request.path.startswith('/api/'):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"

        return response

    return app

app = create_app()

if __name__ == '__main__':
    print("[SYSTEM BOOT] Iniciando servidor APS ESE 2026...")
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=Config.DEBUG)
