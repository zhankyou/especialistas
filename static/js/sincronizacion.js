/**
 * MOTOR DE SINCRONIZACIÓN PWA - CLIENTE ES6
 * Gestiona lectura de cola local, borrado granular, enrutamiento a edición y despacho Batch (Upsert).
 */

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('/login');
        return;
    }

    const tableBody = document.getElementById('sync-table-body');
    const syncBtn = document.getElementById('btn-sync-all');
    const clearBtn = document.getElementById('btn-clear-queue');

    loadSyncQueue();

    if (syncBtn) {
        syncBtn.addEventListener('click', executeBatchSync);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('ALERTA DE SEGURIDAD: ¿Está seguro de eliminar TODOS los registros pendientes? Perderá los expedientes permanentemente.')) {
                localStorage.removeItem('aps_sync_queue');
                loadSyncQueue();
            }
        });
    }

    function loadSyncQueue() {
        if (!tableBody) return;

        let queue = [];
        try {
            queue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
        } catch (e) {
            console.error('[SYNC ERROR] Corrupción en el LocalStorage.', e);
            queue = [];
        }

        tableBody.innerHTML = '';

        if (queue.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#64748b;">
                <i class="fas fa-check-circle fa-3x" style="color:#10b981; margin-bottom:15px;"></i><br>
                <span style="font-size:1.1rem; font-weight:bold;">Sincronización al 100%</span><br>
                No hay expedientes pendientes en el almacenamiento de este dispositivo.
            </td></tr>`;
            if (syncBtn) syncBtn.disabled = true;
            if (clearBtn) clearBtn.disabled = true;
            return;
        }

        if (syncBtn) syncBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;

        queue.forEach(item => {
            const tr = document.createElement('tr');
            const p = item.payload || {};
            const fecha = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Desconocida';
            const safeId = p.local_id || 'LOCAL-UNKNOWN';
            const safeModulo = (item.modulo || 'general').toLowerCase();

            let badgeColor = '#64748b';
            if(safeModulo === 'nutricion') badgeColor = '#10b981';
            else if(safeModulo === 'respiratoria') badgeColor = '#06b6d4';
            else if(safeModulo === 'fisioterapia') badgeColor = '#f59e0b';

            tr.innerHTML = `
                <td style="font-family:monospace; font-weight:bold;">${safeId}</td>
                <td><span style="background:${badgeColor}; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">${safeModulo.toUpperCase()}</span></td>
                <td><strong>${p.nombre_jefe || p.nombre_jefe_hogar || 'Sin Nombre'}</strong><br><small style="color:#64748b;">Doc: ${p.doc_identidad || 'N/A'}</small></td>
                <td>${fecha}</td>
                <td style="text-align:center;">
                    <span style="color:#f59e0b; font-weight:bold; font-size:0.9rem;"><i class="fas fa-wifi" style="text-decoration:line-through;"></i> En Espera</span>
                </td>
                <td style="text-align:center;">
                    <button class="btn-icon-table btn-edit-local" title="Editar Expediente" data-id="${safeId}" data-modulo="${safeModulo}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon-table btn-delete-local" title="Descartar Registro" data-id="${safeId}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        attachTableEvents();
    }

    function attachTableEvents() {
        document.querySelectorAll('.btn-edit-local').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const modulo = e.currentTarget.getAttribute('data-modulo');
                window.location.href = `/${modulo}?local_edit_id=${id}`;
            });
        });

        document.querySelectorAll('.btn-delete-local').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('¿Desea descartar este expediente de la cola de sincronización?')) {
                    let queue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
                    queue = queue.filter(item => item.payload.local_id !== id);
                    localStorage.setItem('aps_sync_queue', JSON.stringify(queue));
                    loadSyncQueue();
                }
            });
        });
    }

    async function executeBatchSync() {
        if (!navigator.onLine) {
            alert('El dispositivo se encuentra sin conexión a Internet. Conéctese a una red Wi-Fi o datos móviles para proceder con el volcado a la Base de Datos.');
            return;
        }

        let queue = [];
        try {
            queue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
        } catch (e) {
            return;
        }

        if (queue.length === 0) return;

        const origBtnText = syncBtn.innerHTML;
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando con PostgreSQL...';
        if (clearBtn) clearBtn.disabled = true;

        try {
            const response = await fetch('/api/sync/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(queue)
            });

            const result = await response.json();

            if (response.ok) {
                const syncedIds = result.synced_ids || [];
                const remainingQueue = queue.filter(item => !syncedIds.includes(item.payload.local_id));

                localStorage.setItem('aps_sync_queue', JSON.stringify(remainingQueue));
                loadSyncQueue();

                if (remainingQueue.length === 0) {
                    alert('Sincronización completada exitosamente. Todos los datos han sido transferidos a la Base de Datos.');
                } else {
                    alert(`Sincronización parcial. Se transfirieron ${syncedIds.length} expedientes. Revise la consola para identificar registros corruptos.`);
                    console.error('[SYNC WARNING] Errores en transacciones DB:', result.errors);
                }
            } else {
                alert(`Error en el servidor: ${result.message || 'Fallo transaccional masivo'}`);
            }
        } catch (error) {
            console.error('[NETWORK ERROR] Error durante la sincronización:', error);
            alert('Fallo de red durante la transmisión de los datos hacia el servidor. Verifique su estabilidad y reintente.');
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = origBtnText;
            if (clearBtn) clearBtn.disabled = false;
        }
    }
});
