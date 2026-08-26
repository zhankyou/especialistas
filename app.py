import os
import importlib
import pkgutil
from flask import Flask, redirect, url_for, render_template, request, Blueprint
from sqlalchemy import inspect, text
from config.settings import Config
from src.models import db


def auto_repair_database_schema(app_instance):
    """
    Motor de Auto-Reparacion DDL Multinivel.
    Garantiza la inyeccion automatica de la columna 'is_deleted' en todas las tablas
    del sistema (especialista, registros_aps y las 3 tablas de especialidad)
    para evitar errores de columna no definida en PostgreSQL Aiven.
    """
    with app_instance.app_context():
        try:
            inspector = inspect(db.engine)

            if inspector.has_table('especialista'):
                existing_columns = [col['name'] for col in inspector.get_columns('especialista')]
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
                    for col_name, col_def in required_columns.items():
                        if col_name not in existing_columns:
                            print(f"[AUTO-REPAIR CLOUD] Inyectando columna {col_name} en especialista")
                            conn.execute(text(f"ALTER TABLE especialista ADD COLUMN {col_name} {col_def};"))
                    conn.commit()

            target_tables = ['formulario_nutricionista', 'formulario_fisioterapia', 'formulario_respiratoria', 'registros_aps']

            for table_name in target_tables:
                if inspector.has_table(table_name):
                    existing_cols = [col['name'] for col in inspector.get_columns(table_name)]
                    with db.engine.connect() as conn:
                        if 'is_deleted' not in existing_cols:
                            print(f"[AUTO-REPAIR CLOUD] Inyectando atributo is_deleted en {table_name}")
                            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL;"))
                        if 'created_at' not in existing_cols:
                            print(f"[AUTO-REPAIR CLOUD] Inyectando atributo created_at en {table_name}")
                            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
                        conn.commit()

            db.create_all()
            print("[AUTO-REPAIR SUCCESS] Todas las tablas de especialidad han sido sincronizadas en Aiven.")

        except Exception as e:
            print(f"[CRITICAL DB ERROR] Fallo durante la ejecucion de DDL Auto-Repair: {str(e)}")


def auto_discover_blueprints(app_instance):
    """
    Patron Auto-Discovery (SOLID: Open/Closed Principle).
    Carga dinamicamente todos los Blueprints dentro del paquete src.controllers.
    """
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
