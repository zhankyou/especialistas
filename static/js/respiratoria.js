/**
 * FORMULARIO RESPIRATORIA - CLIENTE ES6
 * Manejo dinámico de tabla de composición familiar, captura de secciones 1-5, hidratación y soporte Read-Only/Edición.
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
    const selectEspecialista = document.getElementById('nombre_profesional');
    const selectTerritorio = document.getElementById('territorio');
    const selectMicroterritorio = document.getElementById('microterritorio');
    const formElement = document.getElementById('respiratoria-form');

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
        <td>
            <select class="form-control comp-tos">
                <option value="NO" ${data.tos === 'NO' ? 'selected' : ''}>NO</option>
                <option value="SI" ${data.tos === 'SI' ? 'selected' : ''}>SÍ</option>
            </select>
        </td>
        <td>
            <select class="form-control comp-cronica">
                <option value="NO" ${data.cronica === 'NO' ? 'selected' : ''}>NO</option>
                <option value="SI" ${data.cronica === 'SI' ? 'selected' : ''}>SÍ</option>
            </select>
        </td>
        <td>
            <select class="form-control comp-menor">
                <option value="NO" ${data.menor === 'NO' ? 'selected' : ''}>NO</option>
                <option value="SI" ${data.menor === 'SI' ? 'selected' : ''}>SÍ</option>
            </select>
        </td>
        <td style="text-align:center;"><button type="button" class="btn-clear btn-remove" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector('.btn-remove').addEventListener('click', () => tr.remove());
}

async function loadAndPopulateRecord(recordId, token, isReadOnly) {
    try {
        const response = await fetch(`/api/respiratoria/${recordId}`, {
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

    // Sección 1: Datos Generales
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
        'nombre_profesional': data.nombre_profesional,
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

    // Sección 2: Composición Familiar
    if (Array.isArray(data.composicion_familiar)) {
        const tbody = document.getElementById('composicion-body');
        if (tbody) {
            tbody.innerHTML = '';
            data.composicion_familiar.forEach(row => addComposicionRow(tbody, row));
        }
    }

    // Sección 3: Riesgos Intradomiciliarios
    if (data.riesgos_intradomiciliarios && typeof data.riesgos_intradomiciliarios === 'object') {
        setRadioValue('r_humo', data.riesgos_intradomiciliarios.r_humo);
        setRadioValue('r_hacinamiento', data.riesgos_intradomiciliarios.r_hacinamiento);
        setRadioValue('r_alergenos', data.riesgos_intradomiciliarios.r_alergenos);
        setRadioValue('r_humedad', data.riesgos_intradomiciliarios.r_humedad);
        setRadioValue('r_tabaquismo', data.riesgos_intradomiciliarios.r_tabaquismo);
        setRadioValue('r_ventilacion', data.riesgos_intradomiciliarios.r_ventilacion);
        if (document.getElementById('obs_entorno')) {
            document.getElementById('obs_entorno').value = data.riesgos_intradomiciliarios.obs_entorno || '';
        }
    }

    // Sección 4: Acciones de Educación
    if (data.acciones_educacion && typeof data.acciones_educacion === 'object') {
        setRadioValue('edu_era_realizado', data.acciones_educacion.edu_era_realizado);
        setRadioValue('edu_era_nivel', data.acciones_educacion.edu_era_nivel);
        setRadioValue('edu_inhalador_realizado', data.acciones_educacion.edu_inhalador_realizado);
        setRadioValue('edu_inhalador_nivel', data.acciones_educacion.edu_inhalador_nivel);
        if (document.getElementById('obs_educacion')) {
            document.getElementById('obs_educacion').value = data.acciones_educacion.obs_educacion || '';
        }
    }

    // Sección 5: Seguimiento Estricto a Casos Activos
    if (data.seguimiento && typeof data.seguimiento === 'object') {
        if (document.getElementById('seg_nombre')) document.getElementById('seg_nombre').value = data.seguimiento.seg_nombre || '';
        if (document.getElementById('seg_edad')) document.getElementById('seg_edad').value = data.seguimiento.seg_edad || '';
        setRadioValue('seg_estado', data.seguimiento.seg_estado);
        setRadioValue('seg_gestion', data.seguimiento.seg_gestion);
        if (document.getElementById('seg_ips')) document.getElementById('seg_ips').value = data.seguimiento.seg_ips || '';
        if (document.getElementById('seg_observacion')) document.getElementById('seg_observacion').value = data.seguimiento.seg_observacion || '';
    }

    renderSignatureToCanvas('canvas-profesional', data.firma_profesional);
    renderSignatureToCanvas('canvas-cuidador', data.firma_cuidador);
}

function setReadOnlyMode(isReadOnly, recordId) {
    const form = document.getElementById('respiratoria-form');
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
        if (btnEdit) btnEdit.onclick = () => window.location.href = `/respiratoria?edit_id=${recordId}`;
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

        // Extracción de Tabla de Composición Familiar
        const composicionList = [];
        document.querySelectorAll('#composicion-body tr').forEach(r => {
            composicionList.push({
                nombre: r.querySelector('.comp-nombre')?.value.trim() || '',
                edad: parseInt(r.querySelector('.comp-edad')?.value || 0, 10),
                eps: r.querySelector('.comp-eps')?.value.trim() || '',
                tos: r.querySelector('.comp-tos')?.value || 'NO',
                cronica: r.querySelector('.comp-cronica')?.value || 'NO',
                menor: r.querySelector('.comp-menor')?.value || 'NO'
            });
        });

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
            nombre_profesional: document.getElementById('nombre_profesional')?.value,
            reg_profesional: regVal,
            nombre_jefe: document.getElementById('nombre_jefe')?.value.trim(),
            doc_identidad: document.getElementById('doc_identidad')?.value.trim(),
            telefono: telVal,
            total_integrantes: totalVal,
            visita_no: document.getElementById('visita_no')?.value.trim(),

            composicion_familiar: composicionList,

            riesgos_intradomiciliarios: {
                r_humo: (document.querySelector('input[name="r_humo"]:checked') || {}).value || 'NO',
                r_hacinamiento: (document.querySelector('input[name="r_hacinamiento"]:checked') || {}).value || 'NO',
                r_alergenos: (document.querySelector('input[name="r_alergenos"]:checked') || {}).value || 'NO',
                r_humedad: (document.querySelector('input[name="r_humedad"]:checked') || {}).value || 'NO',
                r_tabaquismo: (document.querySelector('input[name="r_tabaquismo"]:checked') || {}).value || 'NO',
                r_ventilacion: (document.querySelector('input[name="r_ventilacion"]:checked') || {}).value || 'NO',
                obs_entorno: document.getElementById('obs_entorno')?.value.trim() || ''
            },

            acciones_educacion: {
                edu_era_realizado: (document.querySelector('input[name="edu_era_realizado"]:checked') || {}).value || 'NO',
                edu_era_nivel: (document.querySelector('input[name="edu_era_nivel"]:checked') || {}).value || 'Medio',
                edu_inhalador_realizado: (document.querySelector('input[name="edu_inhalador_realizado"]:checked') || {}).value || 'NO',
                edu_inhalador_nivel: (document.querySelector('input[name="edu_inhalador_nivel"]:checked') || {}).value || 'Medio',
                obs_educacion: document.getElementById('obs_educacion')?.value.trim() || ''
            },

            seguimiento: {
                seg_nombre: document.getElementById('seg_nombre')?.value.trim() || '',
                seg_edad: parseInt(document.getElementById('seg_edad')?.value || 0, 10),
                seg_estado: (document.querySelector('input[name="seg_estado"]:checked') || {}).value || '',
                seg_gestion: (document.querySelector('input[name="seg_gestion"]:checked') || {}).value || '',
                seg_ips: document.getElementById('seg_ips')?.value.trim() || '',
                seg_observacion: document.getElementById('seg_observacion')?.value.trim() || ''
            },

            sintomatologia: {
                motivo: document.getElementById('obs_entorno')?.value.trim() || 'Evaluación Respiratoria General'
            },

            plan_cuidado: {
                conducta: document.getElementById('obs_educacion')?.value.trim() || 'Pautas de prevención ERA aplicadas.'
            },

            remite: (document.querySelector('input[name="seg_gestion"]:checked') || {}).value.includes('Reporte') ? 'SI' : 'NO',
            cc_profesional: document.getElementById('cc_profesional')?.value.trim(),
            cc_cuidador: document.getElementById('cc_cuidador')?.value.trim(),
            firma_profesional: firmaProfData,
            firma_cuidador: firmaCuidData
        };

        try {
            const response = await fetch('/api/respiratoria/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                alert(activeEditId ? 'Valoración Respiratoria actualizada correctamente.' : 'Valoración Respiratoria guardada correctamente.');
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
