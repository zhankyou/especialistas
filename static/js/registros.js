/**
 * CORE REGISTROS ENGINE - APS ESE 2026
 * Arquitectura: ES6 Class Pattern (SOLID: Single Responsibility Principle)
 * Responsabilidades: Renderizado SPA, Seguridad XSS, Peticiones asincronas y BLOB Streaming.
 */

class RegistrosEngine {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userRole = localStorage.getItem('rol') ? localStorage.getItem('rol').trim().toUpperCase() : 'PROFESIONAL_APS';
        this.isDeletedView = false;

        this.tableBody = document.getElementById('table-body');
        this.searchInput = document.getElementById('search-input');
        this.searchForm = document.getElementById('search-form');
        this.exportModal = document.getElementById('export-modal');
        this.filterSelect = document.getElementById('export_filter_type');
        this.exportForm = document.getElementById('export-form');

        this.searchTimeout = null;
    }

    init() {
        if (!this.token) {
            window.location.replace('/login');
            return;
        }

        this.bindEvents();
        this.fetchRegistros();
        this.exposeGlobalMethods();
    }

    bindEvents() {
        if (this.searchForm) {
            this.searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.fetchRegistros();
            });
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.fetchRegistros();
                }, 500);
            });
        }

        const btnOpen = document.getElementById('btn-open-export');
        const btnClose = document.getElementById('btn-close-export');
        const btnCancel = document.getElementById('btn-cancel-export');

        if (btnOpen) btnOpen.addEventListener('click', () => this.exportModal.classList.add('active'));
        if (btnClose) btnClose.addEventListener('click', () => this.exportModal.classList.remove('active'));
        if (btnCancel) btnCancel.addEventListener('click', () => this.exportModal.classList.remove('active'));

        window.addEventListener('click', (e) => {
            if (e.target === this.exportModal) this.exportModal.classList.remove('active');
        });

        if (this.filterSelect) {
            this.filterSelect.addEventListener('change', (e) => {
                document.querySelectorAll('.export-option-group').forEach(el => el.classList.remove('active'));
                const val = e.target.value;
                if (val !== 'todo') {
                    const group = document.getElementById(`opt-${val}`);
                    if (group) group.classList.add('active');
                }
            });
        }

        if (this.exportForm) {
            this.exportForm.addEventListener('submit', (e) => this.handleExport(e));
        }
    }

    sanitizeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    async fetchRegistros() {
        if (!this.tableBody) return;

        const searchTerm = this.searchInput ? this.searchInput.value.trim() : '';
        this.tableBody.innerHTML = '<tr><td colspan="6" class="empty-state" style="text-align:center;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Consolidando expedientes desde PostgreSQL Aiven...</td></tr>';

        try {
            const url = `/api/registros/list?deleted=${this.isDeletedView}&search=${encodeURIComponent(searchTerm)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                this.renderTable(data.data);
            } else {
                this.tableBody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:#dc2626; text-align:center;">Error del Servidor: ${this.sanitizeHTML(data.message)}</td></tr>`;
            }
        } catch (error) {
            console.error('[NETWORK ERROR]', error);
            this.tableBody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color:#dc2626; text-align:center;">Fallo de conexion con la Base de Datos.</td></tr>';
        }
    }

    renderTable(records) {
        this.tableBody.innerHTML = '';

        if (!records || records.length === 0) {
            this.tableBody.innerHTML = `<tr><td colspan="6" class="empty-state" style="text-align:center; color:#64748b;"><i class="fas fa-folder-open fa-2x"></i><br><br>No se encontraron expedientes registrados.</td></tr>`;
            return;
        }

        records.forEach(rec => {
            const safeId = this.sanitizeHTML(rec.id);
            const safeModulo = this.sanitizeHTML(rec.modulo || 'general').toLowerCase();
            const safeFecha = this.sanitizeHTML(rec.fecha_visita);
            const safeCodigo = this.sanitizeHTML(rec.codigo_familia);
            const safeNombre = this.sanitizeHTML(rec.nombre_jefe_hogar);
            const safeDoc = this.sanitizeHTML(rec.doc_identidad);
            const safeEmail = this.sanitizeHTML(rec.especialista_email);

            const badgeClass = safeModulo === 'nutricion' ? 'bg-nut' : safeModulo === 'respiratoria' ? 'bg-res' : 'bg-fis';
            let actionButtons = '';

            if (!this.isDeletedView) {
                actionButtons = `
                    <button class="btn-icon btn-pdf" title="Descargar PDF" onclick="window.Engine.downloadPdf('${safeModulo}', '${safeId}')"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-icon btn-edit" title="Editar Expediente" onclick="window.Engine.editRecord('${safeModulo}', '${safeId}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-del" title="Mover a Papelera" onclick="window.Engine.toggleDelete('${safeId}', true)"><i class="fas fa-trash-alt"></i></button>
                `;
            } else {
                if (this.userRole !== 'ADMINISTRADOR' && this.userRole !== 'COORDINADOR') {
                    actionButtons = `<button class="btn-icon" style="background:#f59e0b; color:white;" title="Solicitar Restauracion" onclick="window.Engine.requestRestore('${safeId}')"><i class="fas fa-paper-plane"></i> Solicitar</button>`;
                } else {
                    actionButtons = `<button class="btn-icon btn-restore" title="Restaurar Expediente" onclick="window.Engine.toggleDelete('${safeId}', false)"><i class="fas fa-undo"></i> Restaurar</button>`;
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${safeFecha}</strong><br>
                    <span style="font-size:0.75rem; color:#888; display:flex; align-items:center; gap:5px; margin-top:2px;">
                        ID: ${safeId.split('-')[0]}...
                        <button type="button" class="btn-copy" onclick="window.Engine.copyId('${safeId}')" title="Copiar ID"><i class="fas fa-copy"></i></button>
                    </span>
                </td>
                <td><span class="badge-mod ${badgeClass}">${safeModulo.toUpperCase()}</span></td>
                <td style="font-family:monospace; font-size:1rem; font-weight:bold; color:var(--navy);">${safeCodigo}</td>
                <td>${safeNombre}<br><span style="font-size:0.75rem; color:#888;">Doc. ${safeDoc}</span></td>
                <td>${safeEmail}</td>
                <td style="text-align:center;"><div class="action-btns" style="justify-content:center;">${actionButtons}</div></td>
            `;
            this.tableBody.appendChild(tr);
        });
    }

    handleExport(e) {
        e.preventDefault();
        const type = this.filterSelect.value;
        let p1 = '', p2 = '';

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

        const downloadUrl = `/api/registros/export?filtro=${encodeURIComponent(type)}&p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        fetch(downloadUrl, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        })
        .then(response => {
            if(!response.ok) throw new Error("Fallo al generar reporte CSV en el servidor.");
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `APS_Informes_${new Date().getTime()}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            this.exportModal.classList.remove('active');
        })
        .catch(err => {
            console.error('[EXPORT ERROR]', err);
            alert("No se pudo generar el archivo de exportacion.");
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
        });
    }

    exposeGlobalMethods() {
        window.Engine = this;

        window.switchTab = (deletedMode) => {
            this.isDeletedView = deletedMode;
            if (this.searchInput) this.searchInput.value = '';

            const tabActivos = document.getElementById('tab-activos');
            const tabPapelera = document.getElementById('tab-papelera');

            if (deletedMode) {
                if(tabActivos) tabActivos.classList.remove('active');
                if(tabPapelera) tabPapelera.classList.add('active-trash');
            } else {
                if(tabActivos) tabActivos.classList.add('active');
                if(tabPapelera) tabPapelera.classList.remove('active-trash');
            }
            this.fetchRegistros();
        };
    }

    copyId(fullId) {
        navigator.clipboard.writeText(fullId).then(() => {
            const toast = document.getElementById('toast-notification');
            if (toast) {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2500);
            }
        }).catch(err => console.error('[CLIPBOARD ERROR]', err));
    }

    downloadPdf(modulo, id) {
        window.open(`/api/${modulo}/${id}/pdf`, '_blank');
    }

    editRecord(modulo, id) {
        const rutaMap = {
            'nutricion': '/nutricion',
            'respiratoria': '/respiratoria',
            'fisioterapia': '/fisioterapia'
        };
        const ruta = rutaMap[modulo] || '/dashboard';
        window.location.href = `${ruta}?edit_id=${id}`;
    }

    async requestRestore(id) {
        if (!confirm('¿Desea enviar una solicitud oficial por Telegram a Coordinacion para restaurar este expediente?')) return;

        try {
            const response = await fetch('/api/registros/request_restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ record_id: id })
            });
            const data = await response.json();
            alert(data.message || 'Solicitud procesada.');
        } catch (err) {
            console.error('[NETWORK ERROR]', err);
            alert("Error de red al intentar contactar al servidor de notificaciones.");
        }
    }

    async toggleDelete(id, deleteFlag) {
        const actionText = deleteFlag ? "mover a la papelera" : "restaurar";
        if (!confirm(`¿Esta seguro de ${actionText} este expediente?`)) return;

        const url = deleteFlag ? `/api/registros/delete/${id}` : `/api/registros/restore/${id}`;
        const method = deleteFlag ? 'DELETE' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.fetchRegistros();
            } else {
                const data = await response.json();
                alert(`Fallo en la operacion: ${data.message}`);
            }
        } catch (err) {
            console.error('[NETWORK ERROR]', err);
            alert("Error de red al modificar el estado del expediente.");
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const appEngine = new RegistrosEngine();
    appEngine.init();
});
