import os
import sys

# Resolución dinámica de rutas absolutas para el entorno virtual WSGI
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# ARQUITECTURA: Importación de Configuración
# La invocación a settings desencadena automáticamente el algoritmo
# de búsqueda del .env antes de que Flask o SQLAlchemy inicien.
from config.settings import Config

from flask import Flask, render_template, request, make_response, send_from_directory
from src.models import db

# ARQUITECTURA ORM: Importación estricta de modelos para popular db.metadata
from src.models.especialista_model import Especialista
from src.models.nutricion_model import FormularioNutricion
from src.models.respiratoria_model import FormularioRespiratoria
from src.models.fisioterapia_model import FormularioFisioterapia

# Componentes de Enrutamiento (Blueprints)
from src.controllers.auth_controller import auth_bp
from src.controllers.nutricion_controller import nutricion_bp
from src.controllers.respiratoria_controller import respiratoria_bp
from src.controllers.fisioterapia_controller import fisioterapia_bp
from src.controllers.sync_controller import sync_bp
from src.controllers.registros_controller import registros_bp
from src.controllers.usuarios_controller import usuarios_bp

def create_app():
    """Fábrica de Aplicaciones WSGI (Arquitectura Modular)."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Vinculación del ORM a la instancia actual de Flask
    db.init_app(app)

    # ARQUITECTURA: Bootstrapping Estructural
    # Fuerza al motor SQLAlchemy a validar y construir las tablas faltantes en el arranque
    with app.app_context():
        db.create_all()

    # Registro de Blueprints (Modularidad y Aislamiento de Controladores)
    app.register_blueprint(auth_bp)
    app.register_blueprint(nutricion_bp)
    app.register_blueprint(respiratoria_bp)
    app.register_blueprint(fisioterapia_bp)
    app.register_blueprint(sync_bp)
    app.register_blueprint(registros_bp)
    app.register_blueprint(usuarios_bp)

    @app.route('/')
    @app.route('/login')
    def login_view():
        return render_template('login.html')

    @app.route('/dashboard')
    def dashboard_view():
        return render_template('dashboard.html')

    @app.route('/nuevo_registro')
    def nuevo_registro_view():
        return render_template('nuevo_registro.html')

    # ARQUITECTURA PWA: Servir Service Worker desde el root para control de Scope Global
    @app.route('/sw.js')
    def service_worker():
        response = make_response(send_from_directory('static', 'sw.js'))
        response.headers['Content-Type'] = 'application/javascript'
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['Service-Worker-Allowed'] = '/'
        return response

    @app.after_request
    def add_header(response):
        # Política de Seguridad y Permisos para el Service Worker
        if 'sw.js' in request.path:
            response.headers['Service-Worker-Allowed'] = '/'
        return response

    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.DEBUG)