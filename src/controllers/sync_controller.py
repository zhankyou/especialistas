from flask import Blueprint, render_template

sync_bp = Blueprint('sync_bp', __name__)

@sync_bp.route('/sincronizacion')
def view_sincronizacion():
    """
    Vista del Dashboard de Sincronización Offline.
    La vista no procesa datos backend; sirve la plantilla PWA
    que interactúa con la IndexedDB/LocalStorage del cliente.
    """
    return render_template('sincronizacion.html')