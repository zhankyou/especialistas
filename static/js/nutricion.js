/**
 * FORMULARIO NUTRICION - CLIENTE ES6
 * Arquitectura: Patrón Offline-First, Actualización Transitoria in-place y Procesamiento Base64 para Google Drive.
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
    const selectNutricionista = document.getElementById('nombre_nutricionista');
    const selectTerritorio = document.getElementById('territorio');
    const selectMicroterritorio = document.getElementById('microterritorio');
    const formElement = document.querySelector('form.form-container') || document.querySelector('form');

    setupTerritoriosAndMicroterritorios(selectTerritorio, selectMicroterritorio);
    await loadDiligenciadores(token, selectNutricionista);
    setupValidations(regProfesionalInput, telefonoInput, totalIntegrantesInput);
    setupGeolocation();
    setupSignaturePads();
    setupFormSubmission(formElement, token);

    if (viewId) {
        await loadAndPopulateRecord(viewId, token, true);
    } else if (editId) {
        await loadAndPopulateRecord(editId, token, false);
    } else if (localEditId) {
        loadAndPopulateLocalRecord(localEditId);
    } else {
        setupDynamicTable();
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
    const suffix = isOffline ? ' (Modo Offline)' : '';
    data.forEach(esp => {
        const option = document.createElement('option');
        option.value = esp.nombre;
        option.textContent = esp.nombre + suffix;
        selectElement.appendChild(option);
    });
}

async function loadAndPopulateRecord(recordId, token, isReadOnly) {
    try {
        const response = await fetch(`/api/nutricion/${recordId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (response.ok && result.status === 'success') {
            populateForm(result.data);
            if (isReadOnly) setReadOnlyMode(true, recordId);
        } else {
            alert(`Error al cargar el expediente: ${result.message}`);
        }
    } catch (err) {
        alert('Fallo de red al intentar consultar los datos del expediente.');
    }
}

function normalizeString(str) {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function setRadioValue(name, val) {
    if (!val) return;
    const targetVal = normalizeString(val);
    document.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(radio => {
        const rVal = normalizeString(radio.value);
        if (rVal === targetVal || (targetVal === 'true' && (rVal === 'si' || rVal === '1')) || (targetVal === 'false' && (rVal === 'no' || rVal === '0'))) {
            radio.checked = true;
        }
    });
}

function setCheckboxValues(name, values) {
    if (!values) return;
    const valList = Array.isArray(values) ? values.map(v => normalizeString(v)) : [normalizeString(values)];
    document.querySelectorAll(`input[type="checkbox"][name="${name}"]`).forEach(chk => {
        const cVal = normalizeString(chk.value);
        if (valList.includes(cVal)) chk.checked = true;
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

    ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_nutricionista', 'reg_profesional', 'doc_identidad', 'telefono', 'total_integrantes', 'visita_no', 'lineas_otra', 'compromiso', 'cc_profesional', 'cc_cuidador'].forEach(id => {
        const mappedId = id === 'reg_profesional' ? 'registro_profesional' : id === 'telefono' ? 'telefono_contacto' : id === 'nombre_jefe' ? 'nombre_jefe_hogar' : id === 'visita_no' ? 'familia_visita_no' : id;
        if (data[mappedId] && document.getElementById(id)) document.getElementById(id).value = data[mappedId];
    });

    if (data.nombre_jefe_hogar && document.getElementById('nombre_jefe')) document.getElementById('nombre_jefe').value = data.nombre_jefe_hogar;

    const tbody = document.getElementById('antropometria-body');
    if (tbody) {
        tbody.innerHTML = '';
        if (Array.isArray(data.antropometria)) {
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
                    <td>
                        <select class="form-control row-dx" required>
                            <option value="">Seleccione...</option>
                            <option value="Desnutrición Aguda (Severa/Mod.)" ${item.dx === 'Desnutrición Aguda (Severa/Mod.)' ? 'selected' : ''}>Desnutrición Aguda (Severa/Mod.)</option>
                            <option value="Riesgo de Desnutrición / Retraso Talla" ${item.dx === 'Riesgo de Desnutrición / Retraso Talla' ? 'selected' : ''}>Riesgo de Desnutrición / Retraso Talla</option>
                            <option value="Peso Adecuado" ${item.dx === 'Peso Adecuado' ? 'selected' : ''}>Peso Adecuado</option>
                            <option value="Sobrepeso-Obesidad" ${item.dx === 'Sobrepeso-Obesidad' ? 'selected' : ''}>Sobrepeso-Obesidad</option>
                        </select>
                    </td>
                    <td><input type="text" class="form-control row-eps" value="${item.eps || ''}" required></td>
                    <td style="text-align:center;"><button type="button" class="btn-clear btn-remove-row" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
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

    if (data.seguimiento) {
        setCheckboxValues('gestion_art', data.seguimiento.gestion);
        setCheckboxValues('soportes', data.seguimiento.soportes);
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
        document.getElementById('btn-enable-edit').onclick = () => window.location.href = `/nutricion?edit_id=${recordId}`;
    }
}

function setupValidations(regProfInput, telefonoInput, totalIntegrantesInput) {
    const enforceNumbers = (el, maxLen) => {
        if(!el) return;
        el.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > maxLen) v = v.substring(0, maxLen);
            e.target.value = v;
        });
    };
    enforceNumbers(regProfInput, 10);
    enforceNumbers(telefonoInput, 10);

    if (totalIntegrantesInput) {
        totalIntegrantesInput.addEventListener('change', (e) => {
            let v = parseInt(e.target.value, 10);
            if (isNaN(v)) return;
            if (v < 1) e.target.value = 1;
            if (v > 20) e.target.value = 20;
        });
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
            geoStatus.textContent = 'Geolocalización no soportada.';
            return;
        }
        btnGeo.disabled = true;
        geoStatus.textContent = 'Obteniendo GPS...';
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                inputLat.value = pos.coords.latitude.toFixed(6);
                inputLon.value = pos.coords.longitude.toFixed(6);
                geoStatus.textContent = 'Capturado.';
                btnGeo.disabled = false;
            },
            (err) => {
                geoStatus.textContent = 'No se pudo obtener ubicación.';
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
    let rowCount = tbody.querySelectorAll('tr').length;

    const addRow = () => {
        rowCount++;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rowCount}</td>
            <td><input type="text" class="form-control row-nombre" required></td>
            <td>
                <select class="form-control row-condicion" required>
                    <option value="Gestante">Gestante</option><option value="Lactante">Lactante</option>
                    <option value="Menor < 5 años">Menor < 5 años</option><option value="Adulto Mayor">Adulto Mayor</option>
                    <option value="Otro" selected>Otro</option>
                </select>
            </td>
            <td><input type="number" step="0.1" class="form-control row-peso" min="1" max="300" required></td>
            <td><input type="number" step="0.1" class="form-control row-talla" min="30" max="250" required></td>
            <td><input type="number" step="0.1" class="form-control row-pb" min="5" max="60"></td>
            <td>
                <select class="form-control row-dx" required>
                    <option value="">Seleccione...</option>
                    <option value="Desnutrición Aguda (Severa/Mod.)">Desnutrición Aguda (Severa/Mod.)</option>
                    <option value="Riesgo de Desnutrición / Retraso Talla">Riesgo de Desnutrición / Retraso Talla</option>
                    <option value="Peso Adecuado">Peso Adecuado</option>
                    <option value="Sobrepeso-Obesidad">Sobrepeso-Obesidad</option>
                </select>
            </td>
            <td><input type="text" class="form-control row-eps" required></td>
            <td style="text-align:center;"><button type="button" class="btn-clear btn-remove-row" style="padding:4px 8px;"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
        tr.querySelector('.btn-remove-row').addEventListener('click', () => tr.remove());
    };
    addBtn.addEventListener('click', addRow);
    if(rowCount === 0) addRow();
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
            ctx.lineWidth = 2; ctx.strokeStyle = '#0f172a'; ctx.lineCap = 'round';
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

        canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
        canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
        clearBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    };

    initCanvas('canvas-profesional', 'clear-profesional');
    initCanvas('canvas-cuidador', 'clear-cuidador');
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
            const fileInput = document.getElementById('evidencia-file');
            const evidenciasList = [];

            // =========================================================================
            // LECTURA NATIVA DE EVIDENCIAS EN BASE64 (Drive Integration)
            // =========================================================================
            if (fileInput && fileInput.files.length > 0) {
                const files = Array.from(fileInput.files).slice(0, 5);
                for (const file of files) {
                    try {
                        const fileData = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = error => reject(error);
                        });
                        evidenciasList.push({ nombre: file.name, tipo: file.type, data: fileData });
                    } catch(err) {
                        console.warn('[BASE64 WARN] Fallo al codificar archivo:', file.name);
                    }
                }
            }

            const antropometriaData = [];
            document.querySelectorAll('#antropometria-body tr').forEach((r, idx) => {
                antropometriaData.push({
                    item: idx + 1,
                    nombre: (r.querySelector('.row-nombre')?.value || '').trim(),
                    condicion: r.querySelector('.row-condicion')?.value || 'Otro',
                    peso: parseFloat(r.querySelector('.row-peso')?.value || 0),
                    talla: parseFloat(r.querySelector('.row-talla')?.value || 0),
                    pb: parseFloat(r.querySelector('.row-pb')?.value || 0),
                    dx: r.querySelector('.row-dx')?.value || '',
                    eps: (r.querySelector('.row-eps')?.value || '').trim()
                });
            });

            const lineasAccion = [];
            document.querySelectorAll('input[name="lineas_accion"]:checked').forEach(c => lineasAccion.push(c.value));

            const gestionArt = [];
            document.querySelectorAll('input[name="gestion_art"]:checked').forEach(c => gestionArt.push(c.value));

            const soportes = [];
            document.querySelectorAll('input[name="soportes"]:checked').forEach(c => soportes.push(c.value));

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
                nombre_nutricionista: getVal('nombre_nutricionista'),
                reg_profesional: getVal('reg_profesional'),
                nombre_jefe: getVal('nombre_jefe'),
                doc_identidad: getVal('doc_identidad'),
                telefono: getVal('telefono'),
                total_integrantes: parseInt(getVal('total_integrantes') || '0', 10),
                visita_no: getVal('visita_no'),
                antropometria: antropometriaData,
                acc_disp: (document.querySelector('input[name="acc_disp"]:checked') || {}).value || '',
                consumo: (document.querySelector('input[name="consumo"]:checked') || {}).value || '',
                hfias: (document.querySelector('input[name="hfias"]:checked') || {}).value || '',
                lineas_accion: lineasAccion,
                lineas_otra: getVal('lineas_otra'),
                compromiso: getVal('compromiso'),
                seguimiento: { gestion: gestionArt, soportes: soportes },
                remite: (document.querySelector('input[name="remite"]:checked') || {}).value || '',
                cc_profesional: getVal('cc_profesional'),
                cc_cuidador: getVal('cc_cuidador'),
                firma_profesional: canvasProf ? canvasProf.toDataURL('image/png') : '',
                firma_cuidador: canvasCuid ? canvasCuid.toDataURL('image/png') : '',
                evidencias: evidenciasList
            };
        } catch (domErr) {
            alert("Error de extracción estructural: " + domErr.message);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
            return;
        }

        const saveToOfflineQueue = () => {
            try {
                let syncQueue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
                syncQueue = syncQueue.filter(q => q.payload.local_id !== payload.local_id); // In-place update
                syncQueue.push({ modulo: 'nutricion', payload: payload, timestamp: new Date().toISOString() });
                localStorage.setItem('aps_sync_queue', JSON.stringify(syncQueue));
                alert(activeLocalEditId ? 'El registro ha sido actualizado localmente.' : 'Sin conexión a Internet. El registro se ha guardado de forma segura en su dispositivo.');
                window.location.replace('/sincronizacion');
            } catch (err) {
                if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    alert('Aviso: El tamaño de las evidencias supera la memoria caché del navegador (Offline). Se guardará el formulario sin los adjuntos pesados.');
                    payload.evidencias = [];
                    let syncQueue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
                    syncQueue = syncQueue.filter(q => q.payload.local_id !== payload.local_id);
                    syncQueue.push({ modulo: 'nutricion', payload: payload, timestamp: new Date().toISOString() });
                    localStorage.setItem('aps_sync_queue', JSON.stringify(syncQueue));
                    window.location.replace('/sincronizacion');
                } else {
                    alert('Fallo crítico al guardar en memoria caché.');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
                }
            }
        };

        if (!navigator.onLine) {
            saveToOfflineQueue();
            return;
        }

        try {
            const response = await fetch('/api/nutricion/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 502 || response.status === 503 || response.status === 504) {
                    saveToOfflineQueue();
                    return;
                }
                const result = await response.json();
                alert(result.message || 'Error del servidor.');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
                return;
            }

            // Exito transaccional (Online) -> Purga de cola local si correspondia
            if (activeLocalEditId) {
                let syncQueue = JSON.parse(localStorage.getItem('aps_sync_queue')) || [];
                syncQueue = syncQueue.filter(q => q.payload.local_id !== activeLocalEditId);
                localStorage.setItem('aps_sync_queue', JSON.stringify(syncQueue));
            }
            alert('Valoración Nutricional guardada en Base de Datos y Evidencias subidas al Drive.');
            window.location.replace('/registros');

        } catch (err) {
            saveToOfflineQueue();
        }
    });
}
