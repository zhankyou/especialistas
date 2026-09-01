/**
 * FORMULARIO RESPIRATORIA - CLIENTE ES6
 * Arquitectura: Patrón Offline-First, Actualización Transitoria in-place y Despacho.
 */

let activeEditId = null;
let activeLocalEditId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('/login');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('view_id');
    const editId = urlParams.get('edit_id');
    const localEditId = urlParams.get('local_edit_id');

    if (editId) activeEditId = editId;
    if (localEditId) activeLocalEditId = localEditId;

    const regProfesionalInput = document.getElementById('reg_profesional');
    const telefonoInput = document.getElementById('telefono');
    const totalIntegrantesInput = document.getElementById('total_integrantes');
    const selectEspecialista = document.getElementById('nombre_profesional');
    const selectTerritorio = document.getElementById('territorio');
    const selectMicroterritorio = document.getElementById('microterritorio');
    const formElement = document.querySelector('form.form-container') || document.querySelector('form');

    setupTerritoriosAndMicroterritorios(selectTerritorio, selectMicroterritorio);
    await loadDiligenciadores(token, selectEspecialista);
    setupValidations(regProfesionalInput, telefonoInput, totalIntegrantesInput);
    setupGeolocation();
    setupSignaturePads();
    setupDynamicTable();
    setupFormSubmission(formElement, token);

    if (viewId) {
        await loadAndPopulateRecord(viewId, token, true);
    } else if (editId) {
        await loadAndPopulateRecord(editId, token, false);
    } else if (localEditId) {
        loadAndPopulateLocalRecord(localEditId);
    }
});

function loadAndPopulateLocalRecord(localId) {
    try {
        const queue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
        const item = queue.find(q => q.payload && q.payload.local_id === localId);
        if (item) {
            populateForm(item.payload);
            const banner = document.createElement('div');
            banner.innerHTML = `<div style="background:#f59e0b; color:white; padding:10px; font-weight:bold; border-radius:4px; margin-bottom:15px; text-align:center;"><i class="fas fa-wifi" style="text-decoration:line-through;"></i> EDITANDO EXPEDIENTE OFFLINE (${localId})</div>`;
            document.querySelector('form').prepend(banner);
        } else {
            alert('No se encontró el registro en la memoria caché del dispositivo.');
            window.location.replace('/sincronizacion');
        }
    } catch (e) {
        console.error('[LOCAL STORAGE ERROR]', e);
    }
}

function setupTerritoriosAndMicroterritorios(selectTerritorio, selectMicroterritorio) {
    if (selectTerritorio) {
        selectTerritorio.innerHTML = '<option value="">Seleccione Territorio...</option>';
        for (let i = 1; i <= 64; i++) {
            const num = i.toString().padStart(2, '0');
            const val = `T${num}`;
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            selectTerritorio.appendChild(opt);
        }
    }

    if (selectMicroterritorio) {
        selectMicroterritorio.innerHTML = '<option value="">Seleccione Microterritorio...</option>';
        for (let i = 1; i <= 3; i++) {
            const num = i.toString().padStart(2, '0');
            const val = `MT${num}`;
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            selectMicroterritorio.appendChild(opt);
        }
    }
}

async function loadDiligenciadores(token, selectElement) {
    if (!selectElement) return;
    try {
        const response = await fetch('/api/usuarios/diligenciadores', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
                localStorage.setItem('diligenciadores_cache', JSON.stringify(result.data));
                renderDiligenciadores(selectElement, result.data, false);
            } else {
                handleOfflineDiligenciadores(selectElement);
            }
        } else {
            handleOfflineDiligenciadores(selectElement);
        }
    } catch (error) {
        handleOfflineDiligenciadores(selectElement);
    }
}

function handleOfflineDiligenciadores(selectElement) {
    const cachedData = localStorage.getItem('diligenciadores_cache');
    if (cachedData) {
        try {
            renderDiligenciadores(selectElement, JSON.parse(cachedData), true);
        } catch (e) {
            selectElement.innerHTML = '<option value="">Error en caché local</option>';
        }
    } else {
        selectElement.innerHTML = '<option value="">Sin conexión y sin caché disponible</option>';
    }
}

function renderDiligenciadores(selectElement, data, isOffline) {
    selectElement.innerHTML = '<option value="">Seleccione un Especialista...</option>';
    if (!data || data.length === 0) return;
    const suffix = isOffline ? ' (Offline)' : '';
    data.forEach(esp => {
        const option = document.createElement('option');
        option.value = esp.nombre;
        option.textContent = esp.nombre + suffix;
        selectElement.appendChild(option);
    });
}

function setupDynamicTable() {
    const addRowBtn = document.getElementById('add-row-btn');
    const tbody = document.getElementById('composicion-body');
    if (!addRowBtn || !tbody) return;
    addRowBtn.addEventListener('click', () => addComposicionRow(tbody));
}

function addComposicionRow(tbody, data = {}) {
    const rowCount = tbody.querySelectorAll('tr').length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${rowCount}</td>
        <td><input type="text" class="form-control comp-nombre" value="${data.nombre || ''}" required></td>
        <td><input type="number" class="form-control comp-edad" value="${data.edad || ''}" min="0" max="120" required></td>
        <td><input type="text" class="form-control comp-eps" value="${data.eps || ''}" required></td>
        <td><select class="form-control comp-tos"><option value="NO" ${data.tos === 'NO' ? 'selected' : ''}>NO</option><option value="SI" ${data.tos === 'SI' ? 'selected' : ''}>SÍ</option></select></td>
        <td><select class="form-control comp-cronica"><option value="NO" ${data.cronica === 'NO' ? 'selected' : ''}>NO</option><option value="SI" ${data.cronica === 'SI' ? 'selected' : ''}>SÍ</option></select></td>
        <td><select class="form-control comp-menor"><option value="NO" ${data.menor === 'NO' ? 'selected' : ''}>NO</option><option value="SI" ${data.menor === 'SI' ? 'selected' : ''}>SÍ</option></select></td>
        <td style="text-align:center;"><button type="button" class="btn-clear btn-remove" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').addEventListener('click', () => tr.remove());
}

async function loadAndPopulateRecord(recordId, token, isReadOnly) {
    try {
        const response = await fetch(`/api/respiratoria/${recordId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await response.json();
        if (response.ok && result.status === 'success') {
            populateForm(result.data);
            if (isReadOnly) setReadOnlyMode(true, recordId);
        } else {
            alert(`Error al cargar: ${result.message}`);
        }
    } catch (err) {
        alert('Fallo de red al intentar consultar los datos.');
    }
}

function normalizeString(str) { return str ? String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : ''; }

function setRadioValue(name, val) {
    if (!val) return;
    const targetVal = normalizeString(val);
    document.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(radio => {
        const rVal = normalizeString(radio.value);
        if (rVal === targetVal || (targetVal === 'true' && rVal === 'si') || (targetVal === 'false' && rVal === 'no')) radio.checked = true;
    });
}

function renderSignatureToCanvas(canvasId, base64Data) {
    if (!base64Data || base64Data.length < 50) return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); };
    img.src = base64Data;
}

function populateForm(data) {
    if (!data) return;

    ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_profesional', 'reg_profesional', 'doc_identidad', 'telefono', 'total_integrantes', 'visita_no', 'cc_profesional', 'cc_cuidador'].forEach(id => {
        const mappedId = id === 'reg_profesional' ? 'registro_profesional' : id === 'telefono' ? 'telefono_contacto' : id === 'nombre_jefe' ? 'nombre_jefe_hogar' : id === 'visita_no' ? 'familia_visita_no' : id;
        if (data[mappedId] && document.getElementById(id)) document.getElementById(id).value = data[mappedId];
    });
    if (data.nombre_jefe_hogar && document.getElementById('nombre_jefe')) document.getElementById('nombre_jefe').value = data.nombre_jefe_hogar;

    if (Array.isArray(data.composicion_familiar)) {
        const b = document.getElementById('composicion-body'); if(b) { b.innerHTML=''; data.composicion_familiar.forEach(r => addComposicionRow(b, r)); }
    }

    if (data.riesgos_intradomiciliarios) {
        setRadioValue('r_humo', data.riesgos_intradomiciliarios.r_humo); setRadioValue('r_hacinamiento', data.riesgos_intradomiciliarios.r_hacinamiento); setRadioValue('r_alergenos', data.riesgos_intradomiciliarios.r_alergenos); setRadioValue('r_humedad', data.riesgos_intradomiciliarios.r_humedad); setRadioValue('r_tabaquismo', data.riesgos_intradomiciliarios.r_tabaquismo); setRadioValue('r_ventilacion', data.riesgos_intradomiciliarios.r_ventilacion);
        if (document.getElementById('obs_entorno')) document.getElementById('obs_entorno').value = data.riesgos_intradomiciliarios.obs_entorno || '';
    }

    if (data.acciones_educacion) {
        setRadioValue('edu_era_realizado', data.acciones_educacion.edu_era_realizado); setRadioValue('edu_era_nivel', data.acciones_educacion.edu_era_nivel); setRadioValue('edu_inhalador_realizado', data.acciones_educacion.edu_inhalador_realizado); setRadioValue('edu_inhalador_nivel', data.acciones_educacion.edu_inhalador_nivel);
        if (document.getElementById('obs_educacion')) document.getElementById('obs_educacion').value = data.acciones_educacion.obs_educacion || '';
    }

    if (data.seguimiento) {
        if (document.getElementById('seg_nombre')) document.getElementById('seg_nombre').value = data.seguimiento.seg_nombre || '';
        if (document.getElementById('seg_edad')) document.getElementById('seg_edad').value = data.seguimiento.seg_edad || '';
        setRadioValue('seg_estado', data.seguimiento.seg_estado); setRadioValue('seg_gestion', data.seguimiento.seg_gestion);
        if (document.getElementById('seg_ips')) document.getElementById('seg_ips').value = data.seguimiento.seg_ips || '';
        if (document.getElementById('seg_observacion')) document.getElementById('seg_observacion').value = data.seguimiento.seg_observacion || '';
    }

    renderSignatureToCanvas('canvas-profesional', data.firma_profesional);
    renderSignatureToCanvas('canvas-cuidador', data.firma_cuidador);
}

function setReadOnlyMode(isReadOnly, recordId) {
    const form = document.querySelector('form');
    if (!form) return;
    form.querySelectorAll('input, select, textarea, button').forEach(el => {
        if (el.id !== 'btn-back-registros' && el.id !== 'btn-enable-edit') el.disabled = isReadOnly;
    });
    document.querySelectorAll('.signature-pad').forEach(canvas => {
        canvas.style.pointerEvents = isReadOnly ? 'none' : 'auto';
        canvas.style.opacity = isReadOnly ? '0.7' : '1';
    });
    const banner = document.getElementById('view-mode-banner');
    if (isReadOnly && banner) {
        banner.classList.add('active');
        document.getElementById('view-record-id').textContent = `ID: ${recordId.split('-')[0]}...`;
        document.getElementById('submit-btn').style.display = 'none';
        document.getElementById('view-mode-actions').style.display = 'flex';
        document.getElementById('btn-back-registros').onclick = () => window.location.href = '/registros';
        document.getElementById('btn-enable-edit').onclick = () => window.location.href = `/respiratoria?edit_id=${recordId}`;
    }
}

function setupValidations(regProfInput, telefonoInput, totalIntegrantesInput) {
    const enforce = (el) => { if(el) el.addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').substring(0, 10)); };
    enforce(regProfInput); enforce(telefonoInput);
    if(totalIntegrantesInput) totalIntegrantesInput.addEventListener('change', e => { let v = parseInt(e.target.value); if(v<1) e.target.value=1; if(v>20) e.target.value=20; });
}

function setupGeolocation() {
    const btnGeo = document.getElementById('btn-geo');
    if (!btnGeo) return;
    btnGeo.addEventListener('click', () => {
        if (!navigator.geolocation) return;
        btnGeo.disabled = true;
        navigator.geolocation.getCurrentPosition(pos => {
            document.getElementById('latitud').value = pos.coords.latitude.toFixed(6);
            document.getElementById('longitud').value = pos.coords.longitude.toFixed(6);
            btnGeo.disabled = false;
        }, err => { btnGeo.disabled = false; }, { enableHighAccuracy: true });
    });
}

function setupSignaturePads() {
    const initCanvas = (canvasId, clearBtnId) => {
        const canvas = document.getElementById(canvasId);
        const clearBtn = document.getElementById(clearBtnId);
        if (!canvas || !clearBtn) return;
        const ctx = canvas.getContext('2d');
        let drawing = false;
        const resize = () => { const rect = canvas.getBoundingClientRect(); canvas.width = rect.width; canvas.height = rect.height; ctx.lineWidth = 2; ctx.lineCap = 'round'; };
        resize();
        const getPos = (e) => { const rect = canvas.getBoundingClientRect(); return { x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top }; };
        const start = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        const move = (e) => { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
        const stop = () => { drawing = false; };
        canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
        canvas.addEventListener('touchstart', start, {passive:false}); canvas.addEventListener('touchmove', move, {passive:false}); window.addEventListener('touchend', stop);
        clearBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    };
    initCanvas('canvas-profesional', 'clear-profesional'); initCanvas('canvas-cuidador', 'clear-cuidador');
}

function setupFormSubmission(form, token) {
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const origText = submitBtn ? submitBtn.innerHTML : 'Guardar';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'; }

        let payload = {};
        const getVal = (id) => (document.getElementById(id)?.value || '').trim();

        try {
            const canvasProf = document.getElementById('canvas-profesional');
            const canvasCuid = document.getElementById('canvas-cuidador');

            const composicionList = []; document.querySelectorAll('#composicion-body tr').forEach(r => composicionList.push({ nombre: r.querySelector('.comp-nombre').value, edad: parseInt(r.querySelector('.comp-edad').value||0), eps: r.querySelector('.comp-eps').value, tos: r.querySelector('.comp-tos').value, cronica: r.querySelector('.comp-cronica').value, menor: r.querySelector('.comp-menor').value }));

            payload = {
                id: activeEditId,
                local_id: activeLocalEditId || ('LOCAL-' + Date.now()),
                fecha_visita: getVal('fecha_visita'),
                territorio: getVal('territorio'),
                microterritorio: getVal('microterritorio'),
                codigo_familia: getVal('codigo_familia'),
                municipio: getVal('municipio') || 'Villavicencio',
                barrio: getVal('barrio'),
                direccion: getVal('direccion'),
                latitud: getVal('latitud'),
                longitud: getVal('longitud'),
                nombre_profesional: getVal('nombre_profesional'),
                reg_profesional: getVal('reg_profesional'),
                nombre_jefe: getVal('nombre_jefe'),
                doc_identidad: getVal('doc_identidad'),
                telefono: getVal('telefono'),
                total_integrantes: parseInt(getVal('total_integrantes') || '0', 10),
                visita_no: getVal('visita_no'),
                composicion_familiar: composicionList,
                riesgos_intradomiciliarios: { r_humo: (document.querySelector('input[name="r_humo"]:checked') || {}).value || 'NO', r_hacinamiento: (document.querySelector('input[name="r_hacinamiento"]:checked') || {}).value || 'NO', r_alergenos: (document.querySelector('input[name="r_alergenos"]:checked') || {}).value || 'NO', r_humedad: (document.querySelector('input[name="r_humedad"]:checked') || {}).value || 'NO', r_tabaquismo: (document.querySelector('input[name="r_tabaquismo"]:checked') || {}).value || 'NO', r_ventilacion: (document.querySelector('input[name="r_ventilacion"]:checked') || {}).value || 'NO', obs_entorno: getVal('obs_entorno') },
                acciones_educacion: { edu_era_realizado: (document.querySelector('input[name="edu_era_realizado"]:checked') || {}).value || 'NO', edu_era_nivel: (document.querySelector('input[name="edu_era_nivel"]:checked') || {}).value || 'Medio', edu_inhalador_realizado: (document.querySelector('input[name="edu_inhalador_realizado"]:checked') || {}).value || 'NO', edu_inhalador_nivel: (document.querySelector('input[name="edu_inhalador_nivel"]:checked') || {}).value || 'Medio', obs_educacion: getVal('obs_educacion') },
                seguimiento: { seg_nombre: getVal('seg_nombre'), seg_edad: parseInt(getVal('seg_edad') || '0', 10), seg_estado: (document.querySelector('input[name="seg_estado"]:checked') || {}).value || '', seg_gestion: (document.querySelector('input[name="seg_gestion"]:checked') || {}).value || '', seg_ips: getVal('seg_ips'), seg_observacion: getVal('seg_observacion') },
                sintomatologia: { motivo: getVal('obs_entorno') || "Evaluación T.R." },
                plan_cuidado: { conducta: getVal('obs_educacion') || "Pautas ERA" },
                remite: (document.querySelector('input[name="seg_gestion"]:checked') || {}).value?.includes('Reporte') ? 'SI' : 'NO',
                cc_profesional: getVal('cc_profesional'),
                cc_cuidador: getVal('cc_cuidador'),
                firma_profesional: canvasProf ? canvasProf.toDataURL('image/png') : '',
                firma_cuidador: canvasCuid ? canvasCuid.toDataURL('image/png') : ''
            };
        } catch (domErr) {
            alert("Error de extracción: " + domErr.message);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
            return;
        }

        const saveToOfflineQueue = () => {
            try {
                let syncQueue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
                syncQueue = syncQueue.filter(q => q.payload.local_id !== payload.local_id);
                syncQueue.push({ modulo: 'respiratoria', payload: payload, timestamp: new Date().toISOString() });
                localStorage.setItem('aps_sync_queue', JSON.stringify(syncQueue));
                alert(activeLocalEditId ? 'El registro ha sido actualizado localmente.' : 'Sin conexión. El registro se ha guardado de forma segura en su dispositivo.');
                window.location.replace('/sincronizacion');
            } catch (err) {
                alert('Fallo al guardar en memoria caché.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
            }
        };

        if (!navigator.onLine) {
            saveToOfflineQueue();
            return;
        }

        try {
            const response = await fetch('/api/respiratoria/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if ([502, 503, 504].includes(response.status)) { saveToOfflineQueue(); return; }
                const result = await response.json();
                alert(result.message || 'Error del servidor.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
                return;
            }

            if (activeLocalEditId) {
                let syncQueue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
                syncQueue = syncQueue.filter(q => q.payload.local_id !== activeLocalEditId);
                localStorage.setItem('aps_sync_queue', JSON.stringify(syncQueue));
            }
            alert('Valoración Respiratoria guardada en Base de Datos.');
            window.location.replace('/registros');

        } catch (err) {
            saveToOfflineQueue();
        }
    });
}
