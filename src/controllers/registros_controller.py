from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from src.models import db
from src.models.registro_model import RegistroAPS
from src.utils.auth_utils import get_user_from_request
from src.services.telegram_service import TelegramService

registros_bp = Blueprint('registros_bp', __name__)


@registros_bp.route('/api/registros/list', methods=['GET'])
def list_registros():
    """Endpoint principal de consulta con soporte para busqueda, Soft Delete y RBAC estricto."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida o token invalido."}), 401

    try:
        user_role = str(user_data.get('rol', 'PROFESIONAL_APS')).strip().upper()
        user_email = str(user_data.get('email', '')).strip()

        is_deleted_requested = request.args.get('deleted', 'false').strip().lower() == 'true'
        search_query = request.args.get('search', '').strip()

        # Mitigacion de Evaluacion Nula en Bases de Datos Heredadas
        if is_deleted_requested:
            base_query = db.session.query(RegistroAPS).filter(RegistroAPS.is_deleted == True)
        else:
            base_query = db.session.query(RegistroAPS).filter(
                or_(RegistroAPS.is_deleted == False, RegistroAPS.is_deleted.is_(None))
            )

        # Regla RBAC: Si NO es Administrador, solo ve sus propios registros
        if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
            base_query = base_query.filter(RegistroAPS.especialista_email == user_email)

        # Buscador Indexado Dinamico
        if search_query:
            search_term = f"%{search_query}%"
            base_query = base_query.filter(
                or_(
                    RegistroAPS.doc_identidad.ilike(search_term),
                    RegistroAPS.nombre_jefe_hogar.ilike(search_term),
                    RegistroAPS.modulo.ilike(search_term),
                    RegistroAPS.codigo_familia.ilike(search_term)
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
        print(f"[DATA ERROR] Error al consultar Base de Datos Maestra: {str(e)}")
        return jsonify({"status": "error", "message": "Fallo de conexion con el Backend."}), 500


@registros_bp.route('/api/registros/request_restore', methods=['POST'])
def request_restore():
    """Despacha notificacion push a Telegram para autorizar restauracion."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    payload = request.get_json()
    if not payload or not payload.get('record_id'):
        return jsonify({"status": "error", "message": "Payload malformado."}), 400

    try:
        TelegramService.send_restoration_request(
            record_id=payload.get('record_id'),
            user_email=user_data.get('email'),
            user_role=user_data.get('rol')
        )
        return jsonify({"status": "success", "message": "Solicitud enviada a los Administradores."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": "Error al procesar notificacion push."}), 500


@registros_bp.route('/api/registros/delete/<record_id>', methods=['DELETE'])
def delete_registro(record_id):
    """Aplica borrado logico (Soft Delete)."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    try:
        registro = db.session.query(RegistroAPS).filter_by(id=record_id).first()
        if not registro:
            return jsonify({"status": "error", "message": "Registro no encontrado."}), 404

        user_role = str(user_data.get('rol', '')).strip().upper()
        if user_role not in ['ADMINISTRADOR', 'COORDINADOR'] and registro.especialista_email != user_data.get('email'):
            return jsonify({"status": "error", "message": "Acceso denegado."}), 403

        registro.is_deleted = True
        db.session.commit()
        return jsonify({"status": "success", "message": "Expediente trasladado a la papelera."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Fallo en operacion de BD."}), 500


@registros_bp.route('/api/registros/restore/<record_id>', methods=['POST'])
def restore_registro(record_id):
    """Restaura un expediente de la papelera."""
    user_data = get_user_from_request(request)
    if not user_data:
        return jsonify({"status": "error", "message": "Autenticacion requerida."}), 401

    try:
        registro = db.session.query(RegistroAPS).filter_by(id=record_id).first()
        if not registro:
            return jsonify({"status": "error", "message": "Registro no encontrado."}), 404

        user_role = str(user_data.get('rol', '')).strip().upper()
        if user_role not in ['ADMINISTRADOR', 'COORDINADOR']:
            return jsonify({"status": "error", "message": "Solo un administrador puede restaurar."}), 403

        registro.is_deleted = False
        db.session.commit()
        return jsonify({"status": "success", "message": "Expediente restaurado."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Fallo en operacion de BD."}), 500
