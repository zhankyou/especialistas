import time
from flask import Blueprint, jsonify

health_bp = Blueprint('health_bp', __name__)

# Variable global para calcular el Uptime del contenedor en Render
START_TIME = time.time()


@health_bp.route('/api/health/ping', methods=['GET'])
def ping():
    """
    Endpoint de telemetría y Keep-Alive.
    No requiere autenticación y no interactúa con la base de datos para evitar
    sobrecarga de IOPS en la capa de persistencia durante los pings automatizados.
    """
    uptime_seconds = int(time.time() - START_TIME)

    return jsonify({
        "status": "online",
        "service": "APS ESE 2026 - Especialistas",
        "uptime_seconds": uptime_seconds,
        "environment": "production"
    }), 200