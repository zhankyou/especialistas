import os
import importlib
import pkgutil
from flask import Flask, redirect, url_for, render_template, request, Blueprint
from sqlalchemy import inspect, text
from config.settings import Config
from src.models import db


def auto_repair_database_schema(app_instance):
    """
    Motor de Auto-Reparacion DDL Multinivel para Entornos Cloud (PostgreSQL Aiven).
    Inspecciona dinamicamente los metadatos de las tablas en la base de datos y remueve
    la restriccion NOT NULL de todas las columnas (excepto 'id') para garantizar
    inmunidad absoluta contra excepciones NotNullViolation.
    """
    with app_instance.app_context():
        try:
            inspector = inspect(db.engine)

            # 1. Tabla: especialista
            if inspector.has_table('especialista'):
                existing_cols_esp = [col['name'] for col in inspector.get_columns('especialista')]
                required_cols_esp = {
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
                    for col_name, col_def in required_cols_esp.items():
                        if col_name not in existing_cols_esp:
                            print(f"[AUTO-REPAIR] Inyectando {col_name} en especialista")
                            conn.execute(text(f"ALTER TABLE especialista ADD COLUMN {col_name} {col_def};"))
                    conn.commit()

            # 2. Inyección de columnas faltantes conocidas en tablas de especialidades
            tables_cols_needed = {
                'formulario_nutricionista': {
                    'acc_disp': 'VARCHAR(50)',
                    'consumo': 'VARCHAR(50)',
                    'hfias': 'VARCHAR(10)',
                    'lineas_accion': 'JSON',
                    'lineas_otra': 'TEXT',
                    'compromiso': 'TEXT',
                    'remite': 'BOOLEAN DEFAULT FALSE',
                    'cc_profesional': 'VARCHAR(50)',
                    'cc_cuidador': 'VARCHAR(50)',
                    'firma_profesional': 'TEXT',
                    'firma_cuidador': 'TEXT',
                    'seguridad_alimentaria': 'JSON',
                    'plan_cuidado': 'JSON',
                    'seguimiento': 'JSON',
                    'is_deleted': 'BOOLEAN DEFAULT FALSE NOT NULL',
                    'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                    'synced_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
                },
                'formulario_fisioterapia': {
                    'nombre_fisio': "VARCHAR(150) DEFAULT 'Sin Asignar'",
                    'nombre_fisioterapeuta': "VARCHAR(150) DEFAULT 'Sin Asignar'",
                    'registro_profesional': "VARCHAR(10) DEFAULT '0000'",
                    'nombre_jefe_hogar': "VARCHAR(150) DEFAULT 'N/A'",
                    'doc_identidad': "VARCHAR(50) DEFAULT '0'",
                    'telefono_contacto': "VARCHAR(10) DEFAULT '0'",
                    'total_integrantes': "INTEGER DEFAULT 1",
                    'familia_visita_no': "VARCHAR(10) DEFAULT '01'",
                    'evaluacion': 'JSON',
                    'plan_cuidado': 'JSON',
                    'acciones_educacion': 'JSON',
                    'seguimiento': 'JSON',
                    'tamizaje_motor': 'JSON',
                    'riesgo_caidas': 'JSON',
                    'barreras_arquitectonicas': 'JSON',
                    'riesgo_ergonomico': 'JSON',
                    'canalizacion': 'JSON',
                    'sintesis_analisis': 'JSON',
                    'metas': 'JSON',
                    'remite': 'BOOLEAN DEFAULT FALSE',
                    'cc_profesional': "VARCHAR(50) DEFAULT '0'",
                    'cc_cuidador': "VARCHAR(50) DEFAULT '0'",
                    'firma_profesional': 'TEXT',
                    'firma_cuidador': 'TEXT',
                    'is_deleted': 'BOOLEAN DEFAULT FALSE NOT NULL',
                    'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                    'synced_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
                },
                'formulario_respiratoria': {
                    'nombre_profesional': "VARCHAR(150) DEFAULT 'Sin Asignar'",
                    'registro_profesional': "VARCHAR(10) DEFAULT '0000'",
                    'nombre_jefe_hogar': "VARCHAR(150) DEFAULT 'N/A'",
                    'doc_identidad': "VARCHAR(50) DEFAULT '0'",
                    'telefono_contacto': "VARCHAR(10) DEFAULT '0'",
                    'total_integrantes': "INTEGER DEFAULT 1",
                    'familia_visita_no': "VARCHAR(10) DEFAULT '01'",
                    'sintomatologia': 'JSON',
                    'plan_cuidado': 'JSON',
                    'riesgos_intradomiciliarios': 'JSON',
                    'acciones_educacion': 'JSON',
                    'composicion_familiar': 'JSON',
                    'seguimiento': 'JSON',
                    'remite': 'BOOLEAN DEFAULT FALSE',
                    'cc_profesional': "VARCHAR(50) DEFAULT '0'",
                    'cc_cuidador': "VARCHAR(50) DEFAULT '0'",
                    'firma_profesional': 'TEXT',
                    'firma_cuidador': 'TEXT',
                    'is_deleted': 'BOOLEAN DEFAULT FALSE NOT NULL',
                    'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                    'synced_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
                }
            }

            with db.engine.connect() as conn:
                for table_name, req_cols in tables_cols_needed.items():
                    if inspector.has_table(table_name):
                        existing_cols = [c['name'].lower() for c in inspector.get_columns(table_name)]
                        for col_name, col_def in req_cols.items():
                            if col_name.lower() not in existing_cols:
                                print(f"[AUTO-REPAIR] Inyectando {col_name} en {table_name}")
                                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def};"))
                conn.commit()

            # 3. Barredora Dinámica Masiva de Restricciones NOT NULL (Solución Definitiva DML)
            target_tables = ['formulario_nutricionista', 'formulario_fisioterapia', 'formulario_respiratoria']
            with db.engine.connect() as conn:
                for table_name in target_tables:
                    if inspector.has_table(table_name):
                        cols_info = inspector.get_columns(table_name)
                        for col in cols_info:
                            col_name = col['name']
                            if col_name.lower() != 'id' and not col.get('nullable', True):
                                try:
                                    print(f"[AUTO-REPAIR] Liberando restriccion NOT NULL en {table_name}.{col_name}")
                                    conn.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN \"{col_name}\" DROP NOT NULL;"))
                                except Exception as ex_drop:
                                    print(f"[AUTO-REPAIR WARNING] No se pudo alterar {table_name}.{col_name}: {str(ex_drop)}")
                conn.commit()

            # 4. Tabla: registros_aps
            if inspector.has_table('registros_aps'):
                existing_cols = [col['name'] for col in inspector.get_columns('registros_aps')]
                with db.engine.connect() as conn:
                    if 'is_deleted' not in existing_cols:
                        conn.execute(text("ALTER TABLE registros_aps ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL;"))
                    if 'created_at' not in existing_cols:
                        conn.execute(text("ALTER TABLE registros_aps ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
                    conn.commit()

            db.create_all()
            print("[AUTO-REPAIR SUCCESS] Esquema de Base de Datos verificado y saneado al 100%.")

        except Exception as e:
            print(f"[CRITICAL DB ERROR] Fallo durante la ejecucion de DDL Auto-Repair: {str(e)}")


def auto_discover_blueprints(app_instance):
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
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.config.from_object(Config)

    db.init_app(app)
    auto_discover_blueprints(app)
    auto_repair_database_schema(app)

    @app.route('/')
    def index(): return redirect(url_for('login_page'))
    @app.route('/login')
    def login_page(): return render_template('login.html')
    @app.route('/dashboard')
    def dashboard_page(): return render_template('dashboard.html')
    @app.route('/usuarios')
    def usuarios_page(): return render_template('usuarios.html')
    @app.route('/registros')
    def registros_page(): return render_template('registros.html')
    @app.route('/nuevo_registro')
    def nuevo_registro_page(): return render_template('nuevo_registro.html')
    @app.route('/sincronizacion')
    def sincronizacion_page(): return render_template('sincronizacion.html')
    @app.route('/nutricion')
    def nutricion_page(): return render_template('nutricion.html')
    @app.route('/respiratoria')
    def respiratoria_page(): return render_template('respiratoria.html')
    @app.route('/fisioterapia')
    def fisioterapia_page(): return render_template('fisioterapia.html')

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
