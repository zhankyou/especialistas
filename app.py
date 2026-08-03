import os
import importlib
import pkgutil
from flask import Flask, redirect, url_for, render_template, request, Blueprint
from sqlalchemy import inspect, text
from config.settings import Config
from src.models import db


def auto_repair_database_schema(app_instance):
    """
    Motor de auto-reparacion DDL operando estrictamente en la nube.
    Garantiza la integridad estructural de la base de datos en Aiven PostgreSQL.
    """
    with app_instance.app_context():
        try:
            inspector = inspect(db.engine)
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
                            conn.execute(
                                text(f"ALTER TABLE {table_especialista} ADD COLUMN {col_name} {col_definition};"))
                    conn.commit()

            db.create_all()
            print("[AUTO-REPAIR SUCCESS] Estructura validada y sincronizada en PostgreSQL Aiven.")

        except Exception as e:
            print(f"[CRITICAL DB ERROR] Fallo de comunicacion con Aiven Cloud: {str(e)}")


def auto_discover_blueprints(app_instance):
    """
    Patron de Arquitectura: Auto-Discovery (Cumplimiento SOLID: Open/Closed Principle).
    Escanea dinamicamente la capa de controladores e inyecta todos los Blueprints validos.
    Esto previene errores 404 al omitir registros manuales de nuevos formularios.
    """
    import src.controllers

    print("[ROUTER INIT] Iniciando escaneo de controladores API...")

    for _, module_name, _ in pkgutil.iter_modules(src.controllers.__path__):
        try:
            module = importlib.import_module(f'src.controllers.{module_name}')
            for attribute_name in dir(module):
                attribute = getattr(module, attribute_name)
                # Si el atributo es una instancia de Blueprint, lo monta en el enrutador
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

    # Inicializacion de capa de persistencia (ORM)
    db.init_app(app)

    # 1. Inyeccion Dinamica de Capa de Negocio (Controladores API)
    auto_discover_blueprints(app)

    # 2. Sincronizacion de Esquemas de Base de Datos
    auto_repair_database_schema(app)

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

    # RUTAS DE FORMULARIOS CLINICOS (ESPECIALIDADES)
    @app.route('/nutricion')
    def nutricion_page():
        return render_template('nutricion.html')

    @app.route('/respiratoria')
    def respiratoria_page():
        return render_template('respiratoria.html')

    @app.route('/fisioterapia')
    def fisioterapia_page():
        return render_template('fisioterapia.html')

    # -------------------------------------------------------------------------
    # MIDDLEWARE DE SEGURIDAD GLOBAL (OWASP)
    # -------------------------------------------------------------------------
    @app.after_request
    def apply_security_headers(response):
        """Bloqueo de vectores de ataque XSS y Clickjacking."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Prevencion de retencion de datos PHI en cache para rutas API
        if request.path.startswith('/api/'):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"

        return response

    return app


# Instancia Global para servidores WSGI (Gunicorn)
app = create_app()

if __name__ == '__main__':
    print("[SYSTEM BOOT] Iniciando servidor APS ESE 2026...")
    print(f"[NETWORK AUDIT] Conectando a Base de Datos Cloud: {Config.aiven_host}")
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=Config.DEBUG)