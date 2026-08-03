import os
from flask import Blueprint, send_from_directory, current_app

pwa_bp = Blueprint('pwa_bp', __name__)

@pwa_bp.route('/manifest.json')
def serve_manifest():
    """
    Despacha el archivo de metadatos de la PWA.
    Define configuracion de instalacion y empaquetado para Android/iOS.
    """
    return send_from_directory(
        os.path.join(current_app.root_path, 'static'),
        'manifest.json',
        mimetype='application/json'
    )

@pwa_bp.route('/sw.js')
def serve_service_worker():
    """
    Despacha el Service Worker desde el nivel raiz virtual.
    Regla arquitectonica: Debe servirse en el dominio base para poseer
    Scope (alcance) sobre todas las rutas de la aplicacion.
    """
    return send_from_directory(
        os.path.join(current_app.root_path, 'static'),
        'sw.js',
        mimetype='application/javascript'
    )