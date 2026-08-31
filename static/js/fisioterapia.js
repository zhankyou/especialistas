/**
 * FORMULARIO FISIOTERAPIA - CLIENTE ES6
 * Manejo dinámico de tablas, captura de secciones 1-8, hidratación y soporte Read-Only/Edición.
 */

let activeEditId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('/login');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('view_id');
    const editId = urlParams.get('edit_id');

    if (editId) {
        activeEditId = editId;
    }

    const regProfesionalInput = document.getElementById('reg_profesional');
    const telefonoInput = document.getElementById('telefono');
    const totalIntegrantesInput = document.getElementById('total_integrantes');
    const selectEspecialista = document.getElementById('nombre_fisio');
    const selectTerritorio = document.getElementById('territorio');
    const selectMicroterritorio = document.getElementById('microterritorio');
    const formElement = document.getElementById('fisioterapia-form');

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
    }
});

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
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            selectElement.innerHTML = '<option value="">Seleccione un Especialista...</option>';
            if (!result.data || result.data.length === 0) {
                selectElement.innerHTML = '<option value="">No hay especialistas DILIGENCIADOR disponibles</option>';
                return;
            }

            result.data.forEach(esp => {
                const option = document.createElement('option');
                option.value = esp.nombre;
                option.textContent = esp.nombre;
                selectElement.appendChild(option);
            });
        } else {
            selectElement.innerHTML = '<option value="">Error al cargar especialistas</option>';
        }
    } catch (error) {
        console.error('[NETWORK ERROR] Error cargando diligenciadores:', error);
        selectElement.innerHTML = '<option value="">Fallo de conexión con servidor</option>';
    }
}

function setupDynamicTables() {
    // 1. Tamizaje Motor
    const addMotorBtn = document.getElementById('add-motor-btn');
    const motorBody = document.getElementById('motor-body');
    if (addMotorBtn && motorBody) {
        addMotorBtn.addEventListener('click', () => addMotorRow(motorBody));
    }

    // 2. Riesgo de Caídas
    const addCaidasBtn = document.getElementById('add-caidas-btn');
    const caidasBody = document.getElementById('caidas-body');
    if (addCaidasBtn && caidasBody) {
        addCaidasBtn.addEventListener('click', () => addCaidasRow(caidasBody));
    }

    // 3. Barreras Arquitectónicas
    const addBarreraBtn = document.getElementById('add-barrera-btn');
    const barrerasBody = document.getElementById('barreras-body');
    if (addBarreraBtn && barrerasBody) {
        addBarreraBtn.addEventListener('click', () => addBarreraRow(barrerasBody));
    }

    // 4. Riesgo Ergonómico
    const addErgoBtn = document.getElementById('add-ergo-btn');
    const ergoBody = document.getElementById('ergo-body');
    if (addErgoBtn && ergoBody) {
        addErgoBtn.addEventListener('click', () => addErgoRow(ergoBody));
    }
}

function addMotorRow(tbody, data = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control motor-nombre" value="${data.nombre || ''}" required></td>
        <td><input type="number" class="form-control motor-edad" value="${data.edad || ''}" min="0" max="5" required></td>
        <td><input type="text" class="form-control motor-hito" value="${data.hito || ''}" required></td>
        <td>
            <select class="form-control motor-cumple">
                <option value="SI" ${data.cumple === 'SI' ? 'selected' : ''}>SÍ</option>
                <option value="NO" ${data.cumple === 'NO' ? 'selected' : ''}>NO</option>
            </select>
        </td>
        <td>
            <select class="form-control motor-alerta">
                <option value="NO" ${data.alerta === 'NO' ? 'selected' : ''}>NO</option>
                <option value="SI" ${data.alerta === 'SI' ? 'selected' : ''}>SÍ</option>
            </select>
        </td>
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
        <td>
            <select class="form-control caidas-equilibrio">
                <option value="Normal" ${data.equilibrio === 'Normal' ? 'selected' : ''}>Normal</option>
                <option value="Alterado" ${data.equilibrio === 'Alterado' ? 'selected' : ''}>Alterado</option>
            </select>
        </td>
        <td>
            <select class="form-control caidas-historial">
                <option value="NO" ${data.historial === 'NO' ? 'selected' : ''}>NO</option>
                <option value="SI" ${data.historial === 'SI' ? 'selected' : ''}>SÍ</option>
            </select>
        </td>
        <td>
            <select class="form-control caidas-fractura">
                <option value="NO" ${data.fractura === 'NO' ? 'selected' : ''}>NO</option>
                <option value="SI" ${data.fractura === 'SI' ? 'selected' : ''}>SÍ</option>
            </select>
        </td>
        <td>
            <select class="form-control caidas-clasificacion">
                <option value="Bajo" ${data.clasificacion === 'Bajo' ? 'selected' : ''}>Bajo Riesgo</option>
                <option value="Medio" ${data.clasificacion === 'Medio' ? 'selected' : ''}>Riesgo Medio</option>
                <option value="Alto" ${data.clasificacion === 'Alto' ? 'selected' : ''}>Alto Riesgo</option>
            </select>
        </td>
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
        <td>
            <select class="form-control barrera-afecta">
                <option value="Todos" ${data.afecta === 'Todos' ? 'selected' : ''}>Todos</option>
                <option value="AM" ${data.afecta === 'AM' ? 'selected' : ''}>Adulto Mayor (AM)</option>
                <option value="PC" ${data.afecta === 'PC' ? 'selected' : ''}>Persona con Discapacidad (PC)</option>
            </select>
        </td>
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
        <td>
            <select class="form-control ergo-nivel">
                <option value="Bajo" ${data.nivel === 'Bajo' ? 'selected' : ''}>Bajo</option>
                <option value="Medio" ${data.nivel === 'Medio' ? 'selected' : ''}>Medio</option>
                <option value="Alto" ${data.nivel === 'Alto' ? 'selected' : ''}>Alto</option>
            </select>
        </td>
        <td style="text-align:center;"><button type="button" class="btn-clear btn-remove" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').addEventListener('click', () => tr.remove());
}

async function loadAndPopulateRecord(recordId, token, isReadOnly) {
    try {
        const response = await fetch(`/api/fisioterapia/${recordId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            populateForm(result.data);
            if (isReadOnly) {
                setReadOnlyMode(true, recordId);
            }
        } else {
            alert(`Error al cargar el expediente: ${result.message || 'Respuesta inválida de servidor'}`);
        }
    } catch (err) {
        console.error('[NETWORK ERROR] Error al recuperar expediente:', err);
        alert('Fallo de red al intentar consultar los datos del expediente.');
    }
}

function normalizeString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function setRadioValue(name, val) {
    if (val === null || val === undefined || val === '') return;
    const targetVal = normalizeString(val);
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);

    radios.forEach(radio => {
        const rVal = normalizeString(radio.value);
        if (
            rVal === targetVal ||
            (targetVal === 'true' && (rVal === 'si' || rVal === '1')) ||
            (targetVal === 'false' && (rVal === 'no' || rVal === '0')) ||
            (targetVal === 'si' && (rVal === 'true' || rVal === '1')) ||
            (targetVal === 'no' && (rVal === 'false' || rVal === '0'))
        ) {
            radio.checked = true;
        }
    });
}

function setCheckboxValues(name, values) {
    if (values === null || values === undefined) return;
    const valList = Array.isArray(values)
        ? values.map(v => normalizeString(v))
        : [normalizeString(values)];

    const checkboxes = document.querySelectorAll(`input[type="checkbox"][name="${name}"]`);
    checkboxes.forEach(chk => {
        const cVal = normalizeString(chk.value);
        if (valList.some(v => v === cVal || (v === 'true' && (cVal === 'si' || cVal === '1')))) {
            chk.checked = true;
        }
    });
}

function renderSignatureToCanvas(canvasId, base64Data) {
    if (!base64Data || base64Data.length < 50) return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = base64Data;
}

function populateForm(data) {
    if (!data) return;

    // Section 1 Data
    const mappings = {
        'fecha_visita': data.fecha_visita,
        'territorio': data.territorio,
        'microterritorio': data.microterritorio,
        'codigo_familia': data.codigo_familia,
        'municipio': data.municipio,
        'barrio': data.barrio,
        'direccion': data.direccion,
        'latitud': data.latitud,
        'longitud': data.longitud,
        'nombre_fisio': data.nombre_fisio,
        'reg_profesional': data.registro_profesional,
        'nombre_jefe': data.nombre_jefe_hogar,
        'doc_identidad': data.doc_identidad,
        'telefono': data.telefono_contacto,
        'total_integrantes': data.total_integrantes,
        'visita_no': data.familia_visita_no,
        'cc_profesional': data.cc_profesional,
        'cc_cuidador': data.cc_cuidador
    };

    for (const [id, val] of Object.entries(mappings)) {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
    }

    // Populate Dynamic Tables
    if (Array.isArray(data.tamizaje_motor)) {
        const motorBody = document.getElementById('motor-body');
        if (motorBody) {
            motorBody.innerHTML = '';
            data.tamizaje_motor.forEach(row => addMotorRow(motorBody, row));
        }
    }

    if (Array.isArray(data.riesgo_caidas)) {
        const caidasBody = document.getElementById('caidas-body');
        if (caidasBody) {
            caidasBody.innerHTML = '';
            data.riesgo_caidas.forEach(row => addCaidasRow(caidasBody, row));
        }
    }

    if (Array.isArray(data.barreras_arquitectonicas)) {
        const barrerasBody = document.getElementById('barreras-body');
        if (barrerasBody) {
            barrerasBody.innerHTML = '';
            data.barreras_arquitectonicas.forEach(row => addBarreraRow(barrerasBody, row));
        }
    }

    if (Array.isArray(data.riesgo_ergonomico)) {
        const ergoBody = document.getElementById('ergo-body');
        if (ergoBody) {
            ergoBody.innerHTML = '';
            data.riesgo_ergonomico.forEach(row => addErgoRow(ergoBody, row));
        }
    }

    // Section 6: Acciones de Educación
    if (data.acciones_educacion && typeof data.acciones_educacion === 'object') {
        setCheckboxValues('edu_tema', data.acciones_educacion.edu_tema);
        setCheckboxValues('edu_herr', data.acciones_educacion.edu_herr);
    }

    // Section 7: Canalización
    if (data.canalizacion && typeof data.canalizacion === 'object') {
        setRadioValue('can_req', data.canalizacion.can_req);
        setCheckboxValues('can_serv', data.canalizacion.can_serv);
        setRadioValue('can_prio', data.canalizacion.can_prio);
        if (document.getElementById('can_otro')) document.getElementById('can_otro').value = data.canalizacion.can_otro || '';
        if (document.getElementById('can_eps')) document.getElementById('can_eps').value = data.canalizacion.can_eps || '';
        if (document.getElementById('can_motivo')) document.getElementById('can_motivo').value = data.canalizacion.can_motivo || '';
    }

    // Section 8: Síntesis de Análisis & Metas
    if (data.sintesis_analisis && typeof data.sintesis_analisis === 'object') {
        setRadioValue('sin_diag', data.sintesis_analisis.sin_diag);
        if (document.getElementById('sin_diag_det')) document.getElementById('sin_diag_det').value = data.sintesis_analisis.sin_diag_det || '';
        setCheckboxValues('sin_plan', data.sintesis_analisis.sin_plan);
        if (document.getElementById('sin_revisita')) document.getElementById('sin_revisita').value = data.sintesis_analisis.sin_revisita || '';
        setCheckboxValues('sin_sop', data.sintesis_analisis.sin_sop);
    }

    if (data.metas && typeof data.metas === 'object') {
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
    const form = document.getElementById('fisioterapia-form');
    if (!form) return;

    const elements = form.querySelectorAll('input, select, textarea, button');

    elements.forEach(el => {
        if (el.id !== 'btn-back-registros' && el.id !== 'btn-enable-edit') {
            el.disabled = isReadOnly;
        }
    });

    document.querySelectorAll('.signature-pad').forEach(canvas => {
        canvas.style.pointerEvents = isReadOnly ? 'none' : 'auto';
        canvas.style.opacity = isReadOnly ? '0.7' : '1';
    });

    const banner = document.getElementById('view-mode-banner');
    const bannerId = document.getElementById('view-record-id');
    const submitBtn = document.getElementById('submit-btn');
    const viewActions = document.getElementById('view-mode-actions');

    if (isReadOnly) {
        if (banner) banner.classList.add('active');
        if (bannerId) bannerId.textContent = `ID: ${recordId.split('-')[0]}...`;
        if (submitBtn) submitBtn.style.display = 'none';
        if (viewActions) viewActions.style.display = 'flex';

        const btnBack = document.getElementById('btn-back-registros');
        const btnEdit = document.getElementById('btn-enable-edit');

        if (btnBack) btnBack.onclick = () => window.location.href = '/registros';
        if (btnEdit) btnEdit.onclick = () => window.location.href = `/fisioterapia?edit_id=${recordId}`;
    }
}

function setupValidations(regProfInput, telefonoInput, totalIntegrantesInput) {
    if (regProfInput) {
        regProfInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) value = value.substring(0, 10);
            e.target.value = value;
        });
    }

    if (telefonoInput) {
        telefonoInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) value = value.substring(0, 10);
            e.target.value = value;
        });
    }

    if (totalIntegrantesInput) {
        const enforceRange = (el) => {
            let val = parseInt(el.value, 10);
            if (isNaN(val)) return;
            if (val < 1) el.value = 1;
            if (val > 20) el.value = 20;
        };

        totalIntegrantesInput.addEventListener('input', (e) => {
            let raw = e.target.value;
            if (raw.length > 2) e.target.value = raw.slice(0, 2);
        });

        totalIntegrantesInput.addEventListener('change', (e) => enforceRange(e.target));
        totalIntegrantesInput.addEventListener('blur', (e) => enforceRange(e.target));
    }
}

function setupGeolocation() {
    const btnGeo = document.getElementById('btn-geo');
    const inputLat = document.getElementById('latitud');
    const inputLon = document.getElementById('longitud');
    const geoStatus = document.getElementById('geo-status');

    if (!btnGeo) return;

    btnGeo.addEventListener('click', () => {
        if (!navigator.geolocation) {
            geoStatus.style.color = '#dc2626';
            geoStatus.textContent = 'Geolocalización no soportada por el navegador.';
            return;
        }

        geoStatus.style.color = '#0284c7';
        geoStatus.textContent = 'Obteniendo posición GPS...';
        btnGeo.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                inputLat.value = pos.coords.latitude.toFixed(6);
                inputLon.value = pos.coords.longitude.toFixed(6);
                geoStatus.style.color = '#16a34a';
                geoStatus.textContent = 'Coordenadas capturadas correctamente.';
                btnGeo.disabled = false;
            },
            (err) => {
                console.warn('[GPS WARNING]', err);
                geoStatus.style.color = '#dc2626';
                geoStatus.textContent = 'No se pudo obtener ubicación automática.';
                btnGeo.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

function setupSignaturePads() {
    const initCanvas = (canvasId, clearBtnId) => {
        const canvas = document.getElementById(canvasId);
        const clearBtn = document.getElementById(clearBtnId);
        if (!canvas || !clearBtn) return null;

        const ctx = canvas.getContext('2d');
        let drawing = false;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width || 300;
            canvas.height = rect.height || 150;
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0f172a';
            ctx.lineCap = 'round';
        };

        resize();

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const start = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        const move = (e) => { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
        const stop = () => { drawing = false; };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);

        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', stop);

        clearBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    };

    initCanvas('canvas-profesional', 'clear-profesional');
    initCanvas('canvas-cuidador', 'clear-cuidador');
}

function setupFormSubmission(form, token) {
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const regProfInput = document.getElementById('reg_profesional');
        const telefonoInput = document.getElementById('telefono');
        const totalIntegrantesInput = document.getElementById('total_integrantes');

        const regVal = regProfInput ? regProfInput.value.trim() : '';
        if (!/^\d{1,10}$/.test(regVal)) {
            alert('El Registro Profesional debe contener únicamente dígitos numéricos (máximo 10).');
            regProfInput.focus();
            return;
        }

        const telVal = telefonoInput ? telefonoInput.value.trim() : '';
        if (!/^\d{10}$/.test(telVal)) {
            alert('El Teléfono de Contacto debe contener exactamente 10 dígitos numéricos.');
            telefonoInput.focus();
            return;
        }

        const totalVal = parseInt(totalIntegrantesInput ? totalIntegrantesInput.value : 0, 10);
        if (isNaN(totalVal) || totalVal < 1 || totalVal > 20) {
            alert('El Total de Integrantes debe ser un valor numérico entre 1 y 20.');
            totalIntegrantesInput.focus();
            return;
        }

        const canvasProf = document.getElementById('canvas-profesional');
        const canvasCuid = document.getElementById('canvas-cuidador');
        const firmaProfData = canvasProf ? canvasProf.toDataURL('image/png') : '';
        const firmaCuidData = canvasCuid ? canvasCuid.toDataURL('image/png') : '';

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando Expediente...';
        }

        // Extracción de Tablas Dinámicas
        const tamizajeMotorList = [];
        document.querySelectorAll('#motor-body tr').forEach(r => {
            tamizajeMotorList.push({
                nombre: r.querySelector('.motor-nombre')?.value.trim() || '',
                edad: parseInt(r.querySelector('.motor-edad')?.value || 0, 10),
                hito: r.querySelector('.motor-hito')?.value.trim() || '',
                cumple: r.querySelector('.motor-cumple')?.value || 'NO',
                alerta: r.querySelector('.motor-alerta')?.value || 'NO',
                accion: r.querySelector('.motor-accion')?.value.trim() || ''
            });
        });

        const riesgoCaidasList = [];
        document.querySelectorAll('#caidas-body tr').forEach(r => {
            riesgoCaidasList.push({
                nombre: r.querySelector('.caidas-nombre')?.value.trim() || '',
                edad: parseInt(r.querySelector('.caidas-edad')?.value || 0, 10),
                tug: parseFloat(r.querySelector('.caidas-tug')?.value || 0),
                unipodal: parseFloat(r.querySelector('.caidas-unipodal')?.value || 0),
                equilibrio: r.querySelector('.caidas-equilibrio')?.value || 'Normal',
                historial: r.querySelector('.caidas-historial')?.value || 'NO',
                fractura: r.querySelector('.caidas-fractura')?.value || 'NO',
                clasificacion: r.querySelector('.caidas-clasificacion')?.value || 'Bajo'
            });
        });

        const barrerasList = [];
        document.querySelectorAll('#barreras-body tr').forEach(r => {
            barrerasList.push({
                area: r.querySelector('.barrera-area')?.value.trim() || '',
                riesgo: r.querySelector('.barrera-riesgo')?.value.trim() || '',
                afecta: r.querySelector('.barrera-afecta')?.value || 'Todos',
                recomendacion: r.querySelector('.barrera-recomendacion')?.value.trim() || ''
            });
        });

        const riesgoErgoList = [];
        document.querySelectorAll('#ergo-body tr').forEach(r => {
            riesgoErgoList.push({
                nombre: r.querySelector('.ergo-nombre')?.value.trim() || '',
                ocupacion: r.querySelector('.ergo-ocupacion')?.value.trim() || '',
                factores: r.querySelector('.ergo-factores')?.value.trim() || '',
                sintomas: r.querySelector('.ergo-sintomas')?.value.trim() || '',
                nivel: r.querySelector('.ergo-nivel')?.value || 'Bajo'
            });
        });

        // Extracción de Checkboxes/Radios
        const eduTema = [];
        document.querySelectorAll('input[name="edu_tema"]:checked').forEach(c => eduTema.push(c.value));
        const eduHerr = [];
        document.querySelectorAll('input[name="edu_herr"]:checked').forEach(c => eduHerr.push(c.value));

        const canServ = [];
        document.querySelectorAll('input[name="can_serv"]:checked').forEach(c => canServ.push(c.value));

        const sinPlan = [];
        document.querySelectorAll('input[name="sin_plan"]:checked').forEach(c => sinPlan.push(c.value));

        const sinSop = [];
        document.querySelectorAll('input[name="sin_sop"]:checked').forEach(c => sinSop.push(c.value));

        const payload = {
            id: activeEditId,
            fecha_visita: document.getElementById('fecha_visita')?.value,
            territorio: document.getElementById('territorio')?.value,
            microterritorio: document.getElementById('microterritorio')?.value,
            codigo_familia: document.getElementById('codigo_familia')?.value.trim(),
            municipio: document.getElementById('municipio')?.value.trim() || 'Villavicencio',
            barrio: document.getElementById('barrio')?.value.trim(),
            direccion: document.getElementById('direccion')?.value.trim(),
            latitud: document.getElementById('latitud')?.value.trim(),
            longitud: document.getElementById('longitud')?.value.trim(),
            nombre_fisio: document.getElementById('nombre_fisio')?.value,
            reg_profesional: regVal,
            nombre_jefe: document.getElementById('nombre_jefe')?.value.trim(),
            doc_identidad: document.getElementById('doc_identidad')?.value.trim(),
            telefono: telVal,
            total_integrantes: totalVal,
            visita_no: document.getElementById('visita_no')?.value.trim(),

            tamizaje_motor: tamizajeMotorList,
            riesgo_caidas: riesgoCaidasList,
            barreras_arquitectonicas: barrerasList,
            riesgo_ergonomico: riesgoErgoList,

            acciones_educacion: {
                edu_tema: eduTema,
                edu_herr: eduHerr
            },
            canalizacion: {
                can_req: (document.querySelector('input[name="can_req"]:checked') || {}).value || 'NO',
                can_serv: canServ,
                can_otro: document.getElementById('can_otro')?.value.trim() || '',
                can_prio: (document.querySelector('input[name="can_prio"]:checked') || {}).value || '',
                can_eps: document.getElementById('can_eps')?.value.trim() || '',
                can_motivo: document.getElementById('can_motivo')?.value.trim() || ''
            },
            sintesis_analisis: {
                sin_diag: (document.querySelector('input[name="sin_diag"]:checked') || {}).value || 'Sin Riesgo',
                sin_diag_det: document.getElementById('sin_diag_det')?.value.trim() || '',
                sin_plan: sinPlan,
                sin_revisita: document.getElementById('sin_revisita')?.value.trim() || '',
                sin_sop: sinSop
            },
            metas: {
                meta_visita: document.getElementById('meta_visita')?.value.trim() || '',
                meta_iec: document.getElementById('meta_iec')?.checked || false,
                meta_can: document.getElementById('meta_can')?.checked || false,
                meta_sesion: (document.querySelector('input[name="meta_sesion"]:checked') || {}).value || 'No'
            },
            evaluacion: {
                resumen: "Valoración integral de Fisioterapia realizada."
            },
            plan_cuidado: {
                conducta: "Pautas IEC y seguimiento por equipo interdisciplinario APS."
            },
            remite: (document.querySelector('input[name="can_req"]:checked') || {}).value === 'SI' ? 'SI' : 'NO',
            cc_profesional: document.getElementById('cc_profesional')?.value.trim(),
            cc_cuidador: document.getElementById('cc_cuidador')?.value.trim(),
            firma_profesional: firmaProfData,
            firma_cuidador: firmaCuidData
        };

        try {
            const response = await fetch('/api/fisioterapia/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                alert(activeEditId ? 'Valoración de Fisioterapia actualizada correctamente.' : 'Valoración de Fisioterapia guardada correctamente.');
                window.location.href = '/registros';
            } else {
                alert(result.message || 'Error al procesar la valoración.');
            }
        } catch (err) {
            console.error('[SUBMIT ERROR]', err);
            alert('Fallo de red al intentar procesar el registro.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar y Generar Registro';
            }
        }
    });
}
