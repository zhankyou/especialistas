from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from src.models import db
from src.models.registro_model import RegistroAPS
from src.utils.auth_utils import get_user_from_request
from src.services.telegram_service import TelegramService

registros_bp = Blueprint('registros_bp', __name__)


@registros_bp.route('/api/registros/list', methods=['GET'])
def list_registros():
    """
    Endpoint principal de consulta con soporte para busqueda y Soft Delete.
    Implementa mitigacion de Filtrado Silencioso (Three-Valued Logic) y Saneamiento RBAC.
    """
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    try:
        # Saneamiento Absoluto de RBAC (Evita desajustes por espacios invisibles o minúsculas)
        user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
        user_email = str(user_data.get('email', '')).strip()

        is_deleted_requested = request.args.get('deleted', 'false').strip().lower() == 'true'
        search_query = request.args.get('search', '').strip()

        # Construccion de query parametrizado con Tolerancia a Nulos en DB Legacy
        if is_deleted_requested:
            base_query = db.session.query(RegistroAPS).filter(RegistroAPS.is_deleted == True)
        else:
            base_query = db.session.query(RegistroAPS).filter(
                or_(RegistroAPS.is_deleted == False, RegistroAPS.is_deleted.is_(None))
            )

        # Regla RBAC: Aislamiento de datos si el rol no es gerencial
        if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
            base_query = base_query.filter(RegistroAPS.profesional_email == user_email)

        # Motor de busqueda indexada
        if search_query:
            search_term = f"%{search_query}%"
            base_query = base_query.filter(
                or_(
                    RegistroAPS.paciente_documento.ilike(search_term),
                    RegistroAPS.paciente_nombre.ilike(search_term),
                    RegistroAPS.especialidad.ilike(search_term)
                )
            )

        registros = base_query.order_by(RegistroAPS.created_at.desc()).all()
        data_list = [r.to_dict() for r in registros]

        return jsonify({
            "status": "success",
            "count": len(data_list),
            "data": data_list
        }), 200

    except Exception as e:
        print(f"[DATA ERROR] Error al consultar PostgreSQL Aiven: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo de conexion con el Backend de Datos."}), 500


@registros_bp.route('/api/registros/detalle/<especialidad>/<record_id>', methods=['GET'])
def get_detalle(especialidad, record_id):
    """Obtiene los detalles de un registro clinico especifico."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "No autorizado"}), 401

    registro = db.session.query(RegistroAPS).filter_by(id=record_id).first()
    if not registro:
        return jsonify({"status": "error", "message": "Expediente no encontrado en la base de datos."}), 404

    return jsonify({"status": "success", "data": registro.to_dict()}), 200


@registros_bp.route('/api/registros/request_restore', methods=['POST'])
def request_restore():
    """Despacha notificacion push a Telegram para autorizar restauracion."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    payload = request.get_json()
    if not payload or not payload.get('record_id'):
        return jsonify({"status": "error", "message": "Payload malformado o sin ID de registro."}), 400

    try:
        TelegramService.send_restoration_request(
            record_id=payload.get('record_id'),
            user_email=user_data.get('email'),
            user_role=user_data.get('rol')
        )
        return jsonify({"status": "success",
                        "message": "Solicitud de restauracion enviada exitosamente a los Administradores."}), 200
    except Exception as e:
        print(f"[TELEGRAM ERROR] Fallo al solicitar restauracion: {str(e)}")
        return jsonify({"status": "error", "message": "Error al procesar la notificacion push."}), 500


@registros_bp.route('/api/registros/delete/<record_id>', methods=['DELETE'])
def delete_registro(record_id):
    """Aplica el borrado logico (Soft Delete) a un expediente."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    try:
        registro = db.session.query(RegistroAPS).filter_by(id=record_id).first()
        if not registro:
            return jsonify({"status": "error", "message": "Registro no encontrado."}), 404

        user_role = str(user_data.get('rol', '')).strip().upper()
        if user_role not in ['ADMINISTRADOR', 'COORDINADOR'] and registro.profesional_email != user_data.get('email'):
            print(f"[SECURITY WARNING] Intento de borrado no autorizado por: {user_data.get('email')}")
            return jsonify(
                {"status": "error", "message": "Acceso denegado. No es propietario de este expediente."}), 403

        registro.is_deleted = True
        db.session.commit()
        print(f"[DATA SUCCESS] Expediente {record_id} enviado a papelera logica.")
        return jsonify({"status": "success", "message": "El expediente fue trasladado a la papelera."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"[DATA ERROR] Fallo al eliminar registro: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo al ejecutar operacion en Base de Datos."}), 500


@registros_bp.route('/api/registros', methods=['POST'])
def create_registro():
    """Generacion de nuevos registros transaccionales."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    payload = request.get_json()
    if not payload:
        return jsonify({"status": "error", "message": "Payload JSON vacio."}), 400

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
            "message": "Registro almacenado correctamente.",
            "data": nuevo_registro.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"[DATA ERROR] Fallo DML al insertar registro: {str(e)}")
        return jsonify({"status": "error", "message": "Error interno al guardar en base de datos."}), 500
