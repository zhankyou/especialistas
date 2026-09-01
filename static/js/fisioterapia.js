/**
 * FORMULARIO FISIOTERAPIA - CLIENTE ES6
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
    const selectEspecialista = document.getElementById('nombre_fisio');
    const selectTerritorio = document.getElementById('territorio');
    const selectMicroterritorio = document.getElementById('microterritorio');
    const formElement = document.querySelector('form.form-container') || document.querySelector('form');

    setupTerritoriosAndMicroterritorios(selectTerritorio, selectMicroterritorio);
    await loadDiligenciadores(token, selectEspecialista);
    setupValidations(regProfesionalInput, telefonoInput, totalIntegrantesInput);
    setupGeolocation();
    setupSignaturePads();
    setupDynamicTables();
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

function setupDynamicTables() {
    const addMotorBtn = document.getElementById('add-motor-btn');
    const motorBody = document.getElementById('motor-body');
    if (addMotorBtn && motorBody) addMotorBtn.addEventListener('click', () => addMotorRow(motorBody));

    const addCaidasBtn = document.getElementById('add-caidas-btn');
    const caidasBody = document.getElementById('caidas-body');
    if (addCaidasBtn && caidasBody) addCaidasBtn.addEventListener('click', () => addCaidasRow(caidasBody));

    const addBarreraBtn = document.getElementById('add-barrera-btn');
    const barrerasBody = document.getElementById('barreras-body');
    if (addBarreraBtn && barrerasBody) addBarreraBtn.addEventListener('click', () => addBarreraRow(barrerasBody));

    const addErgoBtn = document.getElementById('add-ergo-btn');
    const ergoBody = document.getElementById('ergo-body');
    if (addErgoBtn && ergoBody) addErgoBtn.addEventListener('click', () => addErgoRow(ergoBody));
}

function addMotorRow(tbody, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control motor-nombre" value="${data.nombre || ''}" required></td>
        <td><input type="number" class="form-control motor-edad" value="${data.edad || ''}" min="0" max="5" required></td>
        <td><input type="text" class="form-control motor-hito" value="${data.hito || ''}" required></td>
        <td><select class="form-control motor-cumple"><option value="SI" ${data.cumple === 'SI' ? 'selected' : ''}>SÍ</option><option value="NO" ${data.cumple === 'NO' ? 'selected' : ''}>NO</option></select></td>
        <td><select class="form-control motor-alerta"><option value="NO" ${data.alerta === 'NO' ? 'selected' : ''}>NO</option><option value="SI" ${data.alerta === 'SI' ? 'selected' : ''}>SÍ</option></select></td>
        <td><input type="text" class="form-control motor-accion" value="${data.accion || ''}"></td>
        <td style="text-align:center;"><button type="button" class="btn-clear btn-remove" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').addEventListener('click', () => tr.remove());
}

function addCaidasRow(tbody, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control caidas-nombre" value="${data.nombre || ''}" required></td>
        <td><input type="number" class="form-control caidas-edad" value="${data.edad || ''}" min="60" max="120" required></td>
        <td><input type="number" step="0.1" class="form-control caidas-tug" value="${data.tug || ''}"></td>
        <td><input type="number" step="0.1" class="form-control caidas-unipodal" value="${data.unipodal || ''}"></td>
        <td><select class="form-control caidas-equilibrio"><option value="Normal" ${data.equilibrio === 'Normal' ? 'selected' : ''}>Normal</option><option value="Alterado" ${data.equilibrio === 'Alterado' ? 'selected' : ''}>Alterado</option></select></td>
        <td><select class="form-control caidas-historial"><option value="NO" ${data.historial === 'NO' ? 'selected' : ''}>NO</option><option value="SI" ${data.historial === 'SI' ? 'selected' : ''}>SÍ</option></select></td>
        <td><select class="form-control caidas-fractura"><option value="NO" ${data.fractura === 'NO' ? 'selected' : ''}>NO</option><option value="SI" ${data.fractura === 'SI' ? 'selected' : ''}>SÍ</option></select></td>
        <td><select class="form-control caidas-clasificacion"><option value="Bajo" ${data.clasificacion === 'Bajo' ? 'selected' : ''}>Bajo Riesgo</option><option value="Medio" ${data.clasificacion === 'Medio' ? 'selected' : ''}>Riesgo Medio</option><option value="Alto" ${data.clasificacion === 'Alto' ? 'selected' : ''}>Alto Riesgo</option></select></td>
        <td style="text-align:center;"><button type="button" class="btn-clear btn-remove" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').addEventListener('click', () => tr.remove());
}

function addBarreraRow(tbody, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control barrera-area" value="${data.area || ''}" required></td>
        <td><input type="text" class="form-control barrera-riesgo" value="${data.riesgo || ''}" required></td>
        <td><select class="form-control barrera-afecta"><option value="Todos" ${data.afecta === 'Todos' ? 'selected' : ''}>Todos</option><option value="AM" ${data.afecta === 'AM' ? 'selected' : ''}>AM</option><option value="PC" ${data.afecta === 'PC' ? 'selected' : ''}>PC</option></select></td>
        <td><input type="text" class="form-control barrera-recomendacion" value="${data.recomendacion || ''}"></td>
        <td style="text-align:center;"><button type="button" class="btn-clear btn-remove" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').addEventListener('click', () => tr.remove());
}

function addErgoRow(tbody, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control ergo-nombre" value="${data.nombre || ''}" required></td>
        <td><input type="text" class="form-control ergo-ocupacion" value="${data.ocupacion || ''}" required></td>
        <td><input type="text" class="form-control ergo-factores" value="${data.factores || ''}"></td>
        <td><input type="text" class="form-control ergo-sintomas" value="${data.sintomas || ''}"></td>
        <td><select class="form-control ergo-nivel"><option value="Bajo" ${data.nivel === 'Bajo' ? 'selected' : ''}>Bajo</option><option value="Medio" ${data.nivel === 'Medio' ? 'selected' : ''}>Medio</option><option value="Alto" ${data.nivel === 'Alto' ? 'selected' : ''}>Alto</option></select></td>
        <td style="text-align:center;"><button type="button" class="btn-clear btn-remove" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').addEventListener('click', () => tr.remove());
}

async function loadAndPopulateRecord(recordId, token, isReadOnly) {
    try {
        const response = await fetch(`/api/fisioterapia/${recordId}`, { headers: { 'Authorization': `Bearer ${token}` } });
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

function setCheckboxValues(name, values) {
    if (!values) return;
    const valList = Array.isArray(values) ? values.map(v => normalizeString(v)) : [normalizeString(values)];
    document.querySelectorAll(`input[type="checkbox"][name="${name}"]`).forEach(chk => {
        if (valList.includes(normalizeString(chk.value))) chk.checked = true;
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

    ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_fisio', 'reg_profesional', 'doc_identidad', 'telefono', 'total_integrantes', 'visita_no', 'cc_profesional', 'cc_cuidador'].forEach(id => {
        const mappedId = id === 'reg_profesional' ? 'registro_profesional' : id === 'telefono' ? 'telefono_contacto' : id === 'nombre_jefe' ? 'nombre_jefe_hogar' : id === 'visita_no' ? 'familia_visita_no' : id;
        if (data[mappedId] && document.getElementById(id)) document.getElementById(id).value = data[mappedId];
    });
    if (data.nombre_jefe_hogar && document.getElementById('nombre_jefe')) document.getElementById('nombre_jefe').value = data.nombre_jefe_hogar;

    if (Array.isArray(data.tamizaje_motor)) {
        const b = document.getElementById('motor-body'); if(b) { b.innerHTML=''; data.tamizaje_motor.forEach(r => addMotorRow(b, r)); }
    }
    if (Array.isArray(data.riesgo_caidas)) {
        const b = document.getElementById('caidas-body'); if(b) { b.innerHTML=''; data.riesgo_caidas.forEach(r => addCaidasRow(b, r)); }
    }
    if (Array.isArray(data.barreras_arquitectonicas)) {
        const b = document.getElementById('barreras-body'); if(b) { b.innerHTML=''; data.barreras_arquitectonicas.forEach(r => addBarreraRow(b, r)); }
    }
    if (Array.isArray(data.riesgo_ergonomico)) {
        const b = document.getElementById('ergo-body'); if(b) { b.innerHTML=''; data.riesgo_ergonomico.forEach(r => addErgoRow(b, r)); }
    }

    if (data.acciones_educacion) {
        setCheckboxValues('edu_tema', data.acciones_educacion.edu_tema);
        setCheckboxValues('edu_herr', data.acciones_educacion.edu_herr);
    }

    if (data.canalizacion) {
        setRadioValue('can_req', data.canalizacion.can_req);
        setCheckboxValues('can_serv', data.canalizacion.can_serv);
        setRadioValue('can_prio', data.canalizacion.can_prio);
        if (document.getElementById('can_otro')) document.getElementById('can_otro').value = data.canalizacion.can_otro || '';
        if (document.getElementById('can_eps')) document.getElementById('can_eps').value = data.canalizacion.can_eps || '';
        if (document.getElementById('can_motivo')) document.getElementById('can_motivo').value = data.canalizacion.can_motivo || '';
    }

    if (data.sintesis_analisis) {
        setRadioValue('sin_diag', data.sintesis_analisis.sin_diag);
        if (document.getElementById('sin_diag_det')) document.getElementById('sin_diag_det').value = data.sintesis_analisis.sin_diag_det || '';
        setCheckboxValues('sin_plan', data.sintesis_analisis.sin_plan);
        if (document.getElementById('sin_revisita')) document.getElementById('sin_revisita').value = data.sintesis_analisis.sin_revisita || '';
        setCheckboxValues('sin_sop', data.sintesis_analisis.sin_sop);
    }

    if (data.metas) {
        if (document.getElementById('meta_visita')) document.getElementById('meta_visita').value = data.metas.meta_visita || '';
        if (document.getElementById('meta_iec')) document.getElementById('meta_iec').checked = Boolean(data.metas.meta_iec);
        if (document.getElementById('meta_can')) document.getElementById('meta_can').checked = Boolean(data.metas.meta_can);
        setRadioValue('meta_sesion', data.metas.meta_sesion);
    }

    setRadioValue('remite', data.remite);
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
        document.getElementById('btn-enable-edit').onclick = () => window.location.href = `/fisioterapia?edit_id=${recordId}`;
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
        navigator.geolocation.getCurrentPosition(pos => {
            document.getElementById('latitud').value = pos.coords.latitude.toFixed(6);
            document.getElementById('longitud').value = pos.coords.longitude.toFixed(6);
        }, err => console.warn(err), { enableHighAccuracy: true });
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

            const tamizajeMotorList = []; document.querySelectorAll('#motor-body tr').forEach(r => tamizajeMotorList.push({ nombre: r.querySelector('.motor-nombre').value, edad: parseInt(r.querySelector('.motor-edad').value||0), hito: r.querySelector('.motor-hito').value, cumple: r.querySelector('.motor-cumple').value, alerta: r.querySelector('.motor-alerta').value, accion: r.querySelector('.motor-accion').value }));
            const riesgoCaidasList = []; document.querySelectorAll('#caidas-body tr').forEach(r => riesgoCaidasList.push({ nombre: r.querySelector('.caidas-nombre').value, edad: parseInt(r.querySelector('.caidas-edad').value||0), tug: parseFloat(r.querySelector('.caidas-tug').value||0), unipodal: parseFloat(r.querySelector('.caidas-unipodal').value||0), equilibrio: r.querySelector('.caidas-equilibrio').value, historial: r.querySelector('.caidas-historial').value, fractura: r.querySelector('.caidas-fractura').value, clasificacion: r.querySelector('.caidas-clasificacion').value }));
            const barrerasList = []; document.querySelectorAll('#barreras-body tr').forEach(r => barrerasList.push({ area: r.querySelector('.barrera-area').value, riesgo: r.querySelector('.barrera-riesgo').value, afecta: r.querySelector('.barrera-afecta').value, recomendacion: r.querySelector('.barrera-recomendacion').value }));
            const riesgoErgoList = []; document.querySelectorAll('#ergo-body tr').forEach(r => riesgoErgoList.push({ nombre: r.querySelector('.ergo-nombre').value, ocupacion: r.querySelector('.ergo-ocupacion').value, factores: r.querySelector('.ergo-factores').value, sintomas: r.querySelector('.ergo-sintomas').value, nivel: r.querySelector('.ergo-nivel').value }));

            const eduTema = []; document.querySelectorAll('input[name="edu_tema"]:checked').forEach(c => eduTema.push(c.value));
            const eduHerr = []; document.querySelectorAll('input[name="edu_herr"]:checked').forEach(c => eduHerr.push(c.value));
            const canServ = []; document.querySelectorAll('input[name="can_serv"]:checked').forEach(c => canServ.push(c.value));
            const sinPlan = []; document.querySelectorAll('input[name="sin_plan"]:checked').forEach(c => sinPlan.push(c.value));
            const sinSop = []; document.querySelectorAll('input[name="sin_sop"]:checked').forEach(c => sinSop.push(c.value));

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
                nombre_fisio: getVal('nombre_fisio'),
                reg_profesional: getVal('reg_profesional'),
                nombre_jefe: getVal('nombre_jefe'),
                doc_identidad: getVal('doc_identidad'),
                telefono: getVal('telefono'),
                total_integrantes: parseInt(getVal('total_integrantes') || '0', 10),
                visita_no: getVal('visita_no'),
                tamizaje_motor: tamizajeMotorList,
                riesgo_caidas: riesgoCaidasList,
                barreras_arquitectonicas: barrerasList,
                riesgo_ergonomico: riesgoErgoList,
                acciones_educacion: { edu_tema: eduTema, edu_herr: eduHerr },
                canalizacion: { can_req: (document.querySelector('input[name="can_req"]:checked') || {}).value || 'NO', can_serv: canServ, can_otro: getVal('can_otro'), can_prio: (document.querySelector('input[name="can_prio"]:checked') || {}).value || '', can_eps: getVal('can_eps'), can_motivo: getVal('can_motivo') },
                sintesis_analisis: { sin_diag: (document.querySelector('input[name="sin_diag"]:checked') || {}).value || 'Sin Riesgo', sin_diag_det: getVal('sin_diag_det'), sin_plan: sinPlan, sin_revisita: getVal('sin_revisita'), sin_sop: sinSop },
                metas: { meta_visita: getVal('meta_visita'), meta_iec: document.getElementById('meta_iec')?.checked || false, meta_can: document.getElementById('meta_can')?.checked || false, meta_sesion: (document.querySelector('input[name="meta_sesion"]:checked') || {}).value || 'No' },
                evaluacion: { resumen: "Valoración Fisioterapia." },
                plan_cuidado: { conducta: "Pautas preventivas aplicadas." },
                remite: (document.querySelector('input[name="can_req"]:checked') || {}).value === 'SI' ? 'SI' : 'NO',
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
                syncQueue.push({ modulo: 'fisioterapia', payload: payload, timestamp: new Date().toISOString() });
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
            const response = await fetch('/api/fisioterapia/save', {
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
            alert('Valoración de Fisioterapia guardada en Base de Datos.');
            window.location.replace('/registros');

        } catch (err) {
            saveToOfflineQueue();
        }
    });
}
