document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Sesión no válida.");
        window.location.replace('/login');
        return;
    }

    // Configuración Arquitectónica del Motor de Colas (Queue Engine)
    const queuesConfig = [
        { storageKey: 'aps_nutricion_queue', moduleName: 'Nutrición', cssClass: 'bg-nutricion', endpoint: '/api/nutricion/save' },
        { storageKey: 'aps_respiratoria_queue', moduleName: 'Terapia Respiratoria', cssClass: 'bg-respiratoria', endpoint: '/api/respiratoria/save' },
        { storageKey: 'aps_fisioterapia_queue', moduleName: 'Fisioterapia', cssClass: 'bg-fisioterapia', endpoint: '/api/fisioterapia/save' }
    ];

    let pendingItems = [];

    // 1. LECTURA DE COLAS (I/O LocalStorage)
    function loadPendingQueues() {
        pendingItems = [];
        queuesConfig.forEach(config => {
            try {
                const queueData = JSON.parse(localStorage.getItem(config.storageKey) || '[]');
                queueData.forEach((item, index) => {
                    pendingItems.push({
                        ...config,
                        originalIndex: index,
                        payload: item,
                        status: 'pending' // pending, syncing, success, error
                    });
                });
            } catch (error) {
                console.error(`Fallo lectura de cola ${config.storageKey}:`, error);
            }
        });
        renderDashboard();
    }

    // 2. RENDERIZADO REACTIVO DEL DOM
    function renderDashboard() {
        document.getElementById('total-pending').innerText = pendingItems.filter(i => i.status === 'pending' || i.status === 'error').length;
        const container = document.getElementById('sync-container');
        container.innerHTML = '';

        if (pendingItems.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--text-muted);">
                <i class="fas fa-check-circle fa-3x" style="color:#10b981; margin-bottom:15px;"></i>
                <h4>Bandeja Limpia</h4><p>No hay formularios pendientes por sincronizar.</p></div>`;
            document.getElementById('btn-sync-all').disabled = true;
            return;
        }
        document.getElementById('btn-sync-all').disabled = false;

        pendingItems.forEach((item, displayIndex) => {
            const statusIcon = item.status === 'success' ? '<i class="fas fa-check-circle" style="color:#16a34a;"></i> Sincronizado' :
                               item.status === 'error' ? '<i class="fas fa-exclamation-circle" style="color:#dc2626;"></i> Error' :
                               item.status === 'syncing' ? '<i class="fas fa-spinner fa-spin" style="color:#0284c7;"></i> Subiendo...' :
                               '<i class="fas fa-clock" style="color:#eab308;"></i> En Espera';

            const card = document.createElement('div');
            card.className = `sync-item ${item.status === 'success' ? 'success' : item.status === 'error' ? 'error' : ''}`;
            card.innerHTML = `
                <div class="item-info">
                    <h4>Familia: ${item.payload.codigo_familia || 'Desconocido'} 
                        <span class="badge-module ${item.cssClass}">${item.moduleName}</span>
                    </h4>
                    <p>
                        <i class="fas fa-calendar-alt"></i> Fecha Visita: ${item.payload.fecha_visita || 'N/A'} | 
                        <i class="fas fa-map-marker-alt"></i> ${item.payload.territorio} - ${item.payload.microterritorio}
                    </p>
                </div>
                <div class="item-actions">
                    <span style="font-size:0.85rem; font-weight:bold; width: 120px; text-align:right;">${statusIcon}</span>
                    <button class="btn-delete" title="Eliminar Registro Corrupto" onclick="deleteItem('${item.storageKey}', ${item.originalIndex})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // 3. FUNCIÓN DE ELIMINACIÓN (Prevención Poison Pills)
    window.deleteItem = function(storageKey, originalIndex) {
        if(confirm('¿Está seguro de eliminar este registro local? Se perderán los datos y evidencias.')) {
            let queueData = JSON.parse(localStorage.getItem(storageKey) || '[]');
            queueData.splice(originalIndex, 1);
            localStorage.setItem(storageKey, JSON.stringify(queueData));
            loadPendingQueues();
        }
    };

    // 4. MOTOR DE SINCRONIZACIÓN SECUENCIAL (Para no saturar el servidor con múltiples subidas de Base64)
    document.getElementById('btn-sync-all').addEventListener('click', async () => {
        if (!navigator.onLine) {
            alert("No hay conexión a Internet. Conéctese a una red Wifi o Móvil para iniciar la sincronización.");
            return;
        }

        const btn = document.getElementById('btn-sync-all');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';

        for (let i = 0; i < pendingItems.length; i++) {
            let item = pendingItems[i];
            if (item.status === 'success') continue;

            item.status = 'syncing';
            renderDashboard();

            try {
                const response = await fetch(item.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(item.payload)
                });

                if (response.ok) {
                    item.status = 'success';
                    // Eliminar del LocalStorage original
                    let queueData = JSON.parse(localStorage.getItem(item.storageKey) || '[]');
                    // El filtrado por índice puede desfasarse si subimos varios al tiempo, lo ideal es purgar usando filter.
                    // Para simplificar: Purgamos el que coincida exactamente en payload (serializado)
                    queueData = queueData.filter(q => JSON.stringify(q) !== JSON.stringify(item.payload));
                    localStorage.setItem(item.storageKey, JSON.stringify(queueData));
                } else {
                    item.status = 'error';
                }
            } catch (err) {
                console.error("Error en sincronización: ", err);
                item.status = 'error';
            }
            renderDashboard();
        }

        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizar Todo a la Nube';
        btn.disabled = false;

        // Recargar vista para limpiar los success
        setTimeout(() => loadPendingQueues(), 2000);
    });

    // Iniciar
    loadPendingQueues();
});