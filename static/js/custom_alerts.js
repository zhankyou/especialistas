/**
 * Módulo Core: Sistema de Diálogos Asíncronos e Interceptor Global.
 * Responsabilidades: Renderizado dinámico en el DOM, prevención de bloqueos
 * de hilo (Non-Blocking UI) e interceptación de alertas nativas de Chrome.
 */
class AppDialog {
    static async alert(title, message) {
        return this._createModal({ title, message, type: 'alert' });
    }

    static _createModal({ title, message, type }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'app-dialog-overlay';

            const modal = document.createElement('div');
            modal.className = 'app-dialog-modal';

            const header = document.createElement('h3');
            header.className = 'app-dialog-title';
            header.innerText = title;

            const body = document.createElement('p');
            body.className = 'app-dialog-message';
            body.innerText = message;

            const footer = document.createElement('div');
            footer.className = 'app-dialog-actions';

            const btnAccept = document.createElement('button');
            btnAccept.className = 'app-dialog-btn app-dialog-btn-primary';
            btnAccept.innerText = 'Aceptar';

            const closeModal = () => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                    }
                    resolve(true);
                }, 300); // Sincronizado con la transición CSS
            };

            btnAccept.onclick = closeModal;

            footer.appendChild(btnAccept);
            modal.appendChild(header);
            modal.appendChild(body);
            modal.appendChild(footer);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Forzar reflow para ejecutar la animación CSS
            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });
        });
    }
}

// Inyección Global en el Objeto Window
window.AppDialog = AppDialog;

// =========================================================================
// MONKEY PATCHING: Interceptor Global de Alertas de Chrome
// =========================================================================
// Esta sobreescritura intercepta cualquier alert("...") existente en tus
// códigos actuales (ej. la alerta al cargar el expediente) y la renderiza
// con el nuevo diseño, evitando que modifiques archivo por archivo.
window.originalAlert = window.alert;

window.alert = function(message) {
    if (window.AppDialog) {
        // Ejecución no bloqueante del nuevo modal UI
        window.AppDialog.alert('Aviso del Sistema', message);
    } else {
        // Fallback defensivo de seguridad
        window.originalAlert(message);
    }
};