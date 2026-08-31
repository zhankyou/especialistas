/**
 * FORMULARIO NUTRICION - CLIENTE ES6
 * Control de Estado de Edición (editId) y Despacho Idempotente de Expedientes.
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
    const selectNutricionista = document.getElementById('nombre_nutricionista');
    const selectTerritorio = document.getElementById('territorio');
    const selectMicroterritorio = document.getElementById('microterritorio');
    const formNutricion = document.getElementById('nutricion-form');

    setupTerritoriosAndMicroterritorios(selectTerritorio, selectMicroterritorio);
    await loadDiligenciadores(token, selectNutricionista);
    setupValidations(regProfesionalInput, telefonoInput, totalIntegrantesInput);
    setupGeolocation();
    setupSignaturePads();
    setupFormSubmission(formNutricion, token);

    if (viewId) {
        await loadAndPopulateRecord(viewId, token, true);
    } else if (editId) {
        await loadAndPopulateRecord(editId, token, false);
    } else {
        setupDynamicTable();
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
            selectElement.innerHTML = '<option value="">Seleccione un Nutricionista...</option>';
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

async function loadAndPopulateRecord(recordId, token, isReadOnly) {
    try {
        const response = await fetch(`/api/nutricion/${recordId}`, {
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

    if (data.fecha_visita && document.getElementById('fecha_visita')) document.getElementById('fecha_visita').value = data.fecha_visita;
    if (data.territorio && document.getElementById('territorio')) document.getElementById('territorio').value = data.territorio;
    if (data.microterritorio && document.getElementById('microterritorio')) document.getElementById('microterritorio').value = data.microterritorio;
    if (data.codigo_familia && document.getElementById('codigo_familia')) document.getElementById('codigo_familia').value = data.codigo_familia;
    if (data.municipio && document.getElementById('municipio')) document.getElementById('municipio').value = data.municipio;
    if (data.barrio && document.getElementById('barrio')) document.getElementById('barrio').value = data.barrio;
    if (data.direccion && document.getElementById('direccion')) document.getElementById('direccion').value = data.direccion;
    if (data.latitud && document.getElementById('latitud')) document.getElementById('latitud').value = data.latitud;
    if (data.longitud && document.getElementById('longitud')) document.getElementById('longitud').value = data.longitud;
    if (data.nombre_nutricionista && document.getElementById('nombre_nutricionista')) document.getElementById('nombre_nutricionista').value = data.nombre_nutricionista;
    if (data.registro_profesional && document.getElementById('reg_profesional')) document.getElementById('reg_profesional').value = data.registro_profesional;
    if (data.nombre_jefe_hogar && document.getElementById('nombre_jefe')) document.getElementById('nombre_jefe').value = data.nombre_jefe_hogar;
    if (data.doc_identidad && document.getElementById('doc_identidad')) document.getElementById('doc_identidad').value = data.doc_identidad;
    if (data.telefono_contacto && document.getElementById('telefono')) document.getElementById('telefono').value = data.telefono_contacto;
    if (data.total_integrantes && document.getElementById('total_integrantes')) document.getElementById('total_integrantes').value = data.total_integrantes;
    if (data.familia_visita_no && document.getElementById('visita_no')) document.getElementById('visita_no').value = data.familia_visita_no;

    const tbody = document.getElementById('antropometria-body');
    if (tbody) {
        tbody.innerHTML = '';
        if (Array.isArray(data.antropometria) && data.antropometria.length > 0) {
            data.antropometria.forEach((item, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td><input type="text" class="form-control row-nombre" value="${item.nombre || ''}" required></td>
                    <td>
                        <select class="form-control row-condicion" required>
                            <option value="Gestante" ${item.condicion === 'Gestante' ? 'selected' : ''}>Gestante</option>
                            <option value="Lactante" ${item.condicion === 'Lactante' ? 'selected' : ''}>Lactante</option>
                            <option value="Menor < 5 años" ${item.condicion === 'Menor < 5 años' ? 'selected' : ''}>Menor < 5 años</option>
                            <option value="Adulto Mayor" ${item.condicion === 'Adulto Mayor' ? 'selected' : ''}>Adulto Mayor</option>
                            <option value="Otro" ${item.condicion === 'Otro' || !item.condicion ? 'selected' : ''}>Otro</option>
                        </select>
                    </td>
                    <td><input type="number" step="0.1" class="form-control row-peso" value="${item.peso || 0}" min="1" max="300" required></td>
                    <td><input type="number" step="0.1" class="form-control row-talla" value="${item.talla || 0}" min="30" max="250" required></td>
                    <td><input type="number" step="0.1" class="form-control row-pb" value="${item.pb || 0}" min="5" max="60"></td>
                    <td><input type="text" class="form-control row-dx" value="${item.dx || ''}" required></td>
                    <td><input type="text" class="form-control row-eps" value="${item.eps || ''}" required></td>
                    <td style="text-align:center;">
                        <button type="button" class="btn-clear btn-remove-row" style="padding:4px 8px; font-size:0.8rem;"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
                tr.querySelector('.btn-remove-row').addEventListener('click', () => tr.remove());
            });
        }
    }

    setRadioValue('acc_disp', data.acc_disp);
    setRadioValue('consumo', data.consumo);
    setRadioValue('hfias', data.hfias);
    setRadioValue('remite', data.remite);

    setCheckboxValues('lineas_accion', data.lineas_accion);

    if (data.lineas_otra && document.getElementById('lineas_otra')) {
        document.getElementById('lineas_otra').value = data.lineas_otra;
    }
    if (data.compromiso && document.getElementById('compromiso')) {
        document.getElementById('compromiso').value = data.compromiso;
    }

    if (data.cc_profesional && document.getElementById('cc_profesional')) document.getElementById('cc_profesional').value = data.cc_profesional;
    if (data.cc_cuidador && document.getElementById('cc_cuidador')) document.getElementById('cc_cuidador').value = data.cc_cuidador;

    renderSignatureToCanvas('canvas-profesional', data.firma_profesional);
    renderSignatureToCanvas('canvas-cuidador', data.firma_cuidador);
}

function setReadOnlyMode(isReadOnly, recordId) {
    const form = document.getElementById('nutricion-form') || document.querySelector('form');
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
        if (btnEdit) btnEdit.onclick = () => window.location.href = `/nutricion?edit_id=${recordId}`;
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

function setupDynamicTable() {
    const addBtn = document.getElementById('add-row-btn');
    const tbody = document.getElementById('antropometria-body');
    if (!addBtn || !tbody) return;

    let rowCount = 0;

    const addRow = () => {
        rowCount++;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rowCount}</td>
            <td><input type="text" class="form-control row-nombre" required></td>
            <td>
                <select class="form-control row-condicion" required>
                    <option value="Gestante">Gestante</option>
                    <option value="Lactante">Lactante</option>
                    <option value="Menor < 5 años">Menor < 5 años</option>
                    <option value="Adulto Mayor">Adulto Mayor</option>
                    <option value="Otro" selected>Otro</option>
                </select>
            </td>
            <td><input type="number" step="0.1" class="form-control row-peso" min="1" max="300" required></td>
            <td><input type="number" step="0.1" class="form-control row-talla" min="30" max="250" required></td>
            <td><input type="number" step="0.1" class="form-control row-pb" min="5" max="60"></td>
            <td><input type="text" class="form-control row-dx" required></td>
            <td><input type="text" class="form-control row-eps" required></td>
            <td style="text-align:center;">
                <button type="button" class="btn-clear btn-remove-row" style="padding:4px 8px; font-size:0.8rem;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
        tr.querySelector('.btn-remove-row').addEventListener('click', () => tr.remove());
    };

    addBtn.addEventListener('click', addRow);
    addRow();
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
            alert('El Registro Profesional debe contener únicamente dígitos numéricos y un máximo de 10 caracteres.');
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
        const origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando Expediente...';

        const antropometriaData = [];
        const rows = document.querySelectorAll('#antropometria-body tr');
        rows.forEach((r, idx) => {
            antropometriaData.push({
                item: idx + 1,
                nombre: r.querySelector('.row-nombre').value.trim(),
                condicion: r.querySelector('.row-condicion').value,
                peso: parseFloat(r.querySelector('.row-peso').value) || 0,
                talla: parseFloat(r.querySelector('.row-talla').value) || 0,
                pb: parseFloat(r.querySelector('.row-pb').value) || 0,
                dx: r.querySelector('.row-dx').value.trim(),
                eps: r.querySelector('.row-eps').value.trim()
            });
        });

        const lineasAccion = [];
        document.querySelectorAll('input[name="lineas_accion"]:checked').forEach(c => lineasAccion.push(c.value));

        const payload = {
            id: activeEditId,
            fecha_visita: document.getElementById('fecha_visita').value,
            territorio: document.getElementById('territorio').value,
            microterritorio: document.getElementById('microterritorio').value,
            codigo_familia: document.getElementById('codigo_familia').value.trim(),
            municipio: document.getElementById('municipio').value.trim(),
            barrio: document.getElementById('barrio').value.trim(),
            direccion: document.getElementById('direccion').value.trim(),
            latitud: document.getElementById('latitud').value.trim(),
            longitud: document.getElementById('longitud').value.trim(),
            nombre_nutricionista: document.getElementById('nombre_nutricionista').value,
            reg_profesional: regVal,
            nombre_jefe: document.getElementById('nombre_jefe').value.trim(),
            doc_identidad: document.getElementById('doc_identidad').value.trim(),
            telefono: telVal,
            total_integrantes: totalVal,
            visita_no: document.getElementById('visita_no').value.trim(),
            antropometria: antropometriaData,
            acc_disp: (document.querySelector('input[name="acc_disp"]:checked') || {}).value || '',
            consumo: (document.querySelector('input[name="consumo"]:checked') || {}).value || '',
            hfias: (document.querySelector('input[name="hfias"]:checked') || {}).value || '',
            lineas_accion: lineasAccion,
            lineas_otra: document.getElementById('lineas_otra').value.trim(),
            compromiso: document.getElementById('compromiso').value.trim(),
            remite: (document.querySelector('input[name="remite"]:checked') || {}).value || '',
            cc_profesional: document.getElementById('cc_profesional').value.trim(),
            cc_cuidador: document.getElementById('cc_cuidador').value.trim(),
            firma_profesional: firmaProfData,
            firma_cuidador: firmaCuidData
        };

        try {
            const response = await fetch('/api/nutricion/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                alert(activeEditId ? 'Valoración Nutricional actualizada correctamente.' : 'Valoración Nutricional guardada correctamente.');
                window.location.href = '/registros';
            } else {
                alert(result.message || 'Error al procesar la valoración.');
            }
        } catch (err) {
            console.error('[SUBMIT ERROR]', err);
            alert('Fallo de red al intentar procesar el registro.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
        }
    });
}
