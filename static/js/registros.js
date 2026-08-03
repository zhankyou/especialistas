/**
 * CORE REGISTROS ENGINE - APS ESE
 * Responsabilidades: Renderizado dinámico, Exportación CSV Blob, RBAC UI y Notificaciones Telegram.
 */

let isDeletedView = false;

document.addEventListener('DOMContentLoaded', () => {
    // Inicialización del Grid de Datos
    fetchRegistros();

    // Motor de Búsqueda Dinámica
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        fetchRegistros();
    });

    // =========================================================================
    // ARQUITECTURA UI: Controlador del Modal de Exportación (Glassmorphism)
    // =========================================================================
    const modal = document.getElementById('export-modal');
    const filterSelect = document.getElementById('export_filter_type');

    const hideAllOptions = () => {
        document.querySelectorAll('.export-option-group').forEach(el => el.classList.remove('active'));
    };

    // Listeners de Apertura y Cierre
    document.getElementById('btn-open-export').addEventListener('click', () => modal.classList.add('active'));
    document.getElementById('btn-close-export').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btn-cancel-export').addEventListener('click', () => modal.classList.remove('active'));

    // Cierre seguro interactuando con la máscara de fondo
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Enrutador visual del formulario de exportación
    filterSelect.addEventListener('change', function() {
        hideAllOptions();
        const val = this.value;
        if (val !== 'todo') {
            const group = document.getElementById(`opt-${val}`);
            if(group) group.classList.add('active');
        }
    });

    // =========================================================================
    // MOTOR DE DESCARGA: Secure Blob Stream Downloader
    // =========================================================================
    document.getElementById('export-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const type = filterSelect.value;
        let p1 = '', p2 = '';

        // Validación estricta de Data Inputs
        if (type === 'mes') {
            p1 = document.getElementById('exp_mes').value;
            if(!p1) { alert("Seleccione un mes."); return; }
        } else if (type === 'rango') {
            p1 = document.getElementById('exp_inicio').value;
            p2 = document.getElementById('exp_fin').value;
            if(!p1 || !p2) { alert("Seleccione ambas fechas."); return; }
        } else if (type === 'especialista') {
            p1 = document.getElementById('exp_email').value.trim();
            if(!p1) { alert("Ingrese un correo."); return; }
        } else if (type === 'especialidad') {
            p1 = document.getElementById('exp_modulo').value;
        }

        const token = localStorage.getItem('token');
        if (!token) { alert("Sesión inválida. Refresque la página."); return; }

        const downloadUrl = `/api/registros/export?filtro=${type}&p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;

        // Bloqueo de Mutación
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando archivo...';

        // Ejecución transaccional del BLOB
        fetch(downloadUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if(!response.ok) throw new Error("Error en servidor al generar el archivo CSV.");
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `APS_Base_Datos_${new Date().getTime()}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

            modal.classList.remove('active');
        })
        .catch(err => {
            alert(err.message);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
        });
    });
});

// =========================================================================
// GESTIÓN DE VISTAS Y OBTENCIÓN DE DATOS
// =========================================================================

window.switchTab = function(deletedMode) {
    isDeletedView = deletedMode;
    document.getElementById('search-input').value = '';

    const tabActivos = document.getElementById('tab-activos');
    const tabPapelera = document.getElementById('tab-papelera');

    if (deletedMode) {
        tabActivos.classList.remove('active');
        tabPapelera.classList.add('active-trash');
    } else {
        tabActivos.classList.add('active');
        tabPapelera.classList.remove('active-trash');
    }

    fetchRegistros();
};

async function fetchRegistros() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('table-body');
    const searchTerm = document.getElementById('search-input').value;

    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Cargando expedientes...</td></tr>';

    try {
        const response = await fetch(`/api/registros/list?deleted=${isDeletedView}&search=${encodeURIComponent(searchTerm)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok) {
            renderTable(data.data);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:red;">Error del Servidor: ${data.message}</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color:red;">Fallo de conexión con el Backend de Datos.</td></tr>';
    }
}

// =========================================================================
// RENDERIZADO DEL DOM Y CONTROL DE ACCESO BASADO EN ROLES (RBAC)
// =========================================================================

function renderTable(records) {
    const tbody = document.getElementById('table-body');
    const userRole = localStorage.getItem('rol') || 'DILIGENCIADOR';
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-folder-open fa-2x"></i><br><br>No se encontraron expedientes con los criterios seleccionados.</td></tr>`;
        return;
    }

    records.forEach(rec => {
        const badgeClass = rec.modulo === 'nutricion' ? 'bg-nut' : rec.modulo === 'respiratoria' ? 'bg-res' : 'bg-fis';
        const dateStr = new Date(rec.fecha_visita).toLocaleDateString('es-CO');

        let actionButtons = '';

        // Vista de Expedientes Activos
        if (!isDeletedView) {
            actionButtons = `
                <button class="btn-icon btn-pdf" title="Descargar PDF" onclick="downloadPdf('${rec.modulo}', '${rec.id}')"><i class="fas fa-file-pdf"></i></button>
                <button class="btn-icon btn-edit" title="Editar Expediente" onclick="editRecord('${rec.modulo}', '${rec.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon btn-del" title="Mover a Papelera" onclick="toggleDelete('${rec.id}', '${rec.modulo}', true)"><i class="fas fa-trash-alt"></i></button>
            `;
        }
        // Vista de Expedientes en Papelera (Protección RBAC)
        else {
            if (userRole === 'DILIGENCIADOR') {
                actionButtons = `<button class="btn-icon" style="background:#f59e0b; color:white;" title="Solicitar Restauración a Coordinación" onclick="requestRestore('${rec.id}')"><i class="fas fa-paper-plane"></i> Solicitar Restauración</button>`;
            } else {
                actionButtons = `<button class="btn-icon btn-restore" title="Restaurar Expediente" onclick="toggleDelete('${rec.id}', '${rec.modulo}', false)"><i class="fas fa-undo"></i> Restaurar</button>`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${dateStr}</strong><br>
                <span style="font-size:0.75rem; color:#888; display:flex; align-items:center; gap:5px; margin-top:2px;">
                    ID: ${rec.id.split('-')[0]}...
                    <button type="button" class="btn-copy" onclick="copyId('${rec.id}')" title="Copiar ID Completo"><i class="fas fa-copy"></i></button>
                </span>
            </td>
            <td><span class="badge-mod ${badgeClass}">${rec.modulo}</span></td>
            <td style="font-family:monospace; font-size:1rem; font-weight:bold; color:var(--navy);">${rec.codigo_familia}</td>
            <td>${rec.nombre_jefe_hogar}<br><span style="font-size:0.75rem; color:#888;">C.C. ${rec.doc_identidad}</span></td>
            <td>${rec.especialista_email}</td>
            <td style="text-align:center;"><div class="action-btns" style="justify-content:center;">${actionButtons}</div></td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// MÉTODOS DE INTERACCIÓN, TELEMETRÍA Y SISTEMA
// =========================================================================

window.requestRestore = async function(id) {
    if (!confirm('¿Desea enviar una solicitud oficial por Telegram a Coordinación para restaurar este expediente?')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/registros/request_restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: id })
        });
        const data = await response.json();
        alert(data.message);
    } catch (err) {
        alert("Error de red al intentar contactar al servidor de Telegram.");
    }
};

window.copyId = function(fullId) {
    navigator.clipboard.writeText(fullId).then(() => {
        const toast = document.getElementById('toast-notification');
        if (toast) {
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }
    }).catch(err => console.error("Error copiando al portapapeles del sistema: ", err));
};

window.downloadPdf = function(modulo, id) {
    window.open(`/api/${modulo}/${id}/pdf`, '_blank');
};

window.editRecord = function(modulo, id) {
    window.location.href = `/${modulo}?edit_id=${id}`;
};

window.toggleDelete = async function(id, modulo, deleteFlag) {
    const actionText = deleteFlag ? "mover a la papelera" : "restaurar";
    if (!confirm(`¿Está seguro de ${actionText} este expediente?`)) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/registros/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: id, modulo: modulo, delete: deleteFlag })
        });

        if (response.ok) {
            fetchRegistros();
        } else {
            const data = await response.json();
            alert(`Fallo en la operación: ${data.message}`);
        }
    } catch (err) {
        alert("Error de red al aplicar borrado lógico.");
    }
};