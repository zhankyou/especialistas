from flask import Blueprint, request, jsonify
from src.models import db
from src.models.registro_model import RegistroAPS
from src.utils.auth_utils import get_user_from_request

registros_bp = Blueprint('registros_bp', __name__)

@registros_bp.route('/api/registros', methods=['GET'])
def get_registros():
    """Consulta de registros controlada por RBAC."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    try:
        user_role = user_data.get('rol', 'profesional_aps').upper()
        user_email = user_data.get('email', '')

        if user_role in ['ADMINISTRADOR', 'COORDINADOR']:
            registros = db.session.query(RegistroAPS).order_by(RegistroAPS.created_at.desc()).all()
        else:
            registros = db.session.query(RegistroAPS).filter_by(
                profesional_email=user_email
            ).order_by(RegistroAPS.created_at.desc()).all()

        data_list = [r.to_dict() for r in registros]

        return jsonify({
            "status": "success",
            "count": len(data_list),
            "data": data_list
        }), 200

    except Exception as e:
        print(f"[DATA ERROR] Error al consultar PostgreSQL Aiven: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo de conexion con el Backend de Datos."}), 500


@registros_bp.route('/api/registros', methods=['POST'])
def create_registro():
    """Creacion de registro con validacion estricta de tipos de datos geograficos."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON vacio."}), 400

    # Funciones de sanitizacion local para Type Casting defensivo
    def parse_float_safe(value):
        try:
            return float(value) if value not in [None, '', 'null', 'undefined'] else None
        except ValueError:
            return None

    try:
        nuevo_registro = RegistroAPS(
            paciente_nombre=payload.get('paciente_nombre', 'Paciente No Especificado').strip(),
            paciente_documento=payload.get('paciente_documento', '00000000').strip(),
            especialidad=payload.get('especialidad', 'General').strip(),
            profesional_email=user_data.get('email'),
            latitud=parse_float_safe(payload.get('latitud')),
            longitud=parse_float_safe(payload.get('longitud')),
            observaciones=payload.get('observaciones', '').strip()
        )

        db.session.add(nuevo_registro)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Registro almacenado correctamente en PostgreSQL Aiven.",
            "data": nuevo_registro.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"[DATA ERROR] Fallo DML al insertar registro: {str(e)}")
        return jsonify({"status": "error", "message": "Error al guardar el registro en la base de datos."}), 500
