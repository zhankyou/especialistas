from flask import Blueprint, request, jsonify, render_template
from src.services.mapas_service import MapasService
from src.utils.auth_utils import get_user_from_request

mapas_bp = Blueprint('mapas_bp', __name__)

@mapas_bp.route('/mapas', methods=['GET'], strict_slashes=False)
def view_mapas():
    """Renderiza la plantilla HTML del Gestor Geoespacial."""
    return render_template('mapas.html')

@mapas_bp.route('/api/mapas/geodata', methods=['GET'], strict_slashes=False)
def get_mapas_data():
    """Endpoint RESTful para el suministro de GeoJSON y coordenadas."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    filter_email = request.args.get('email', '').strip()

    result = MapasService.get_geodata(user_data, filter_email=filter_email)
    return jsonify(result), result.get('code', 200)

@mapas_bp.route('/api/mapas/emails', methods=['GET'], strict_slashes=False)
def get_mapas_emails():
    """Endpoint para nutrir el Datalist HTML5 del frontend con correos de especialistas."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    result = MapasService.get_unique_emails(user_data)
    return jsonify(result), result.get('code', 200)
