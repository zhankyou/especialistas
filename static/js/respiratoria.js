document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit_id');

    ['territorio', 'microterritorio'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let max = id === 'territorio' ? 64 : 3; let pref = id === 'territorio' ? 'T' : 'MT';
            for(let i=1; i<=max; i++) {
                let opt = document.createElement('option'); opt.value = opt.textContent = pref + i.toString().padStart(2,'0'); el.appendChild(opt);
            }
        }
    });

    const codFamInput = document.getElementById('codigo_familia');
    if (codFamInput) {
        codFamInput.addEventListener('input', function(e) {
            let val = this.value.toUpperCase();
            if (val.length > 0 && val[0] !== 'F') val = 'F' + val.replace(/[^0-9]/g, ''); else if (val.length > 1) val = 'F' + val.substring(1).replace(/[^0-9]/g, '');
            this.value = val.substring(0, 5);
        });
    }

    document.getElementById('btn-geo')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-geo'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localizando...';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { document.getElementById('latitud').value = pos.coords.latitude.toFixed(6); document.getElementById('longitud').value = pos.coords.longitude.toFixed(6); btn.innerHTML = '<i class="fas fa-check"></i> Capturado'; btn.style.background = '#16a34a'; },
                (err) => { alert("Error GPS."); btn.innerHTML = '<i class="fas fa-satellite-dish"></i> Reintentar'; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } else { alert("Fallo API."); }
    });

    const tbody = document.getElementById('composicion-body');
    document.getElementById('add-row-btn')?.addEventListener('click', () => {
        const rowCount = tbody.children.length + 1;
        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${rowCount}</td>
                <td><input type="text" class="nombre form-control" placeholder="Nombre completo"></td>
                <td><input type="number" class="edad form-control" placeholder="Años"></td>
                <td><input type="text" class="eps form-control" placeholder="EPS"></td>
                <td><select class="sintoma_tos form-control"><option value="NO">NO</option><option value="SI">SÍ</option></select></td>
                <td><select class="sospecha form-control"><option value="NO">NO</option><option value="SI">SÍ</option></select></td>
                <td><select class="menor5 form-control"><option value="NO">NO</option><option value="SI">SÍ</option></select></td>
                <td style="text-align:center;"><button type="button" class="btn-clear" onclick="this.closest('tr').remove()">X</button></td>
            </tr>
        `);
    });

    function initCanvas(id, clearId) {
        const c = document.getElementById(id), ctx = c?.getContext('2d'); if(!ctx) return null;
        c.width = c.getBoundingClientRect().width; c.height = 150; ctx.lineWidth=2; ctx.lineCap='round'; ctx.strokeStyle='#0a1f3d'; let drawing=false;
        const pos = e => { e.preventDefault(); const b=c.getBoundingClientRect(); return [(e.touches?e.touches[0].clientX:e.clientX)-b.left, (e.touches?e.touches[0].clientY:e.clientY)-b.top]; };
        c.onmousedown=c.ontouchstart=e=>{ drawing=true; ctx.beginPath(); ctx.moveTo(...pos(e)); };
        c.onmousemove=c.ontouchmove=e=>{ if(drawing){ ctx.lineTo(...pos(e)); ctx.stroke(); } };
        c.onmouseup=c.ontouchend=()=>drawing=false;
        document.getElementById(clearId).onclick=()=>ctx.clearRect(0,0,c.width,c.height);
        return c;
    }
    const canvasProf = initCanvas('canvas-profesional', 'clear-profesional');
    const canvasCuid = initCanvas('canvas-cuidador', 'clear-cuidador');

    let evArr = [];
    document.getElementById('evidencia-file')?.addEventListener('change', async function(e) {
        evArr = await Promise.all(Array.from(e.target.files).slice(0,5).map(f => new Promise(r => { let rd = new FileReader(); rd.onload = ev => r({type:f.type, data:ev.target.result}); rd.readAsDataURL(f); })));
    });

    // =========================================================================
    // ARQUITECTURA DATA HYDRATION - RESPIRATORIA
    // =========================================================================
    if (editId) {
        document.querySelector('.submit-btn').innerHTML = '<i class="fas fa-sync"></i> Actualizar Expediente y PDF';
        const headerTitle = document.querySelector('h2');
        if(headerTitle) headerTitle.innerHTML += ' <span style="color:#dc2626; font-size:0.8rem; background:#fee2e2; padding:3px 6px; border-radius:4px; vertical-align:middle; margin-left:10px;">MODO EDICIÓN</span>';

        fetch(`/api/registros/detalle/respiratoria/${editId}`, { headers: { 'Authorization': `Bearer ${token}` }})
        .then(res => res.json())
        .then(payload => {
            if (payload.status === 'success') {
                const data = payload.data;
                const txtFields = ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_profesional', 'reg_profesional', 'nombre_jefe', 'doc_identidad', 'telefono', 'total_integrantes', 'visita_no'];
                const dbFields = ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_profesional', 'registro_profesional', 'nombre_jefe_hogar', 'doc_identidad', 'telefono_contacto', 'total_integrantes', 'familia_visita_no'];

                txtFields.forEach((id, i) => { const el = document.getElementById(id); if (el && data[dbFields[i]]) el.value = data[dbFields[i]]; });

                if (document.getElementById('cc_profesional')) document.getElementById('cc_profesional').value = data.cc_profesional || '';
                if (document.getElementById('cc_cuidador')) document.getElementById('cc_cuidador').value = data.cc_cuidador || '';

                if (data.composicion_familiar) {
                    data.composicion_familiar.forEach(item => {
                        document.getElementById('add-row-btn').click();
                        const lastRow = tbody.lastElementChild;
                        lastRow.querySelector('.nombre').value = item.nombre || ''; lastRow.querySelector('.edad').value = item.edad || '';
                        lastRow.querySelector('.eps').value = item.eps || ''; lastRow.querySelector('.sintoma_tos').value = item.sintoma_tos || 'NO';
                        lastRow.querySelector('.sospecha').value = item.sospecha || 'NO'; lastRow.querySelector('.menor5').value = item.menor5 || 'NO';
                    });
                }

                if (data.riesgos_intradomiciliarios) {
                    ['humo', 'hacinamiento', 'alergenos', 'humedad', 'tabaquismo', 'ventilacion'].forEach(r => {
                        const rb = document.querySelector(`input[name="r_${r}"][value="${data.riesgos_intradomiciliarios[r]}"]`);
                        if(rb) rb.checked = true;
                    });
                    document.getElementById('obs_entorno').value = data.riesgos_intradomiciliarios.observaciones || '';
                }

                if (data.acciones_educacion) {
                    const eaR = document.querySelector(`input[name="edu_era_realizado"][value="${data.acciones_educacion.era_realizado}"]`); if(eaR) eaR.checked = true;
                    const eaN = document.querySelector(`input[name="edu_era_nivel"][value="${data.acciones_educacion.era_nivel}"]`); if(eaN) eaN.checked = true;
                    const eiR = document.querySelector(`input[name="edu_inhalador_realizado"][value="${data.acciones_educacion.inhalador_realizado}"]`); if(eiR) eiR.checked = true;
                    const eiN = document.querySelector(`input[name="edu_inhalador_nivel"][value="${data.acciones_educacion.inhalador_nivel}"]`); if(eiN) eiN.checked = true;
                    document.getElementById('obs_educacion').value = data.acciones_educacion.observaciones || '';
                }

                if (data.seguimiento_era) {
                    document.getElementById('seg_nombre').value = data.seguimiento_era.nombre || '';
                    document.getElementById('seg_edad').value = data.seguimiento_era.edad || '';
                    const seE = document.querySelector(`input[name="seg_estado"][value="${data.seguimiento_era.estado}"]`); if(seE) seE.checked = true;
                    const seG = document.querySelector(`input[name="seg_gestion"][value="${data.seguimiento_era.gestion}"]`); if(seG) seG.checked = true;
                    document.getElementById('seg_ips').value = data.seguimiento_era.ips || '';
                    document.getElementById('seg_observacion').value = data.seguimiento_era.observacion || '';
                }

                alert("Expediente cargado con éxito. Por auditoría ISO 27001, debe refirmar el documento para aplicar cambios.");
            }
        });
    }

    const form = document.getElementById('respiratoria-form');
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const submitBtn = form.querySelector('.submit-btn');
            const originalBtnText = submitBtn.innerHTML;

            try {
                if (!/^F\d{4}$/.test(codFamInput.value)) { alert("Formato incorrecto: F0000."); return; }

                submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

                const composicion = Array.from(tbody.querySelectorAll('tr')).map(tr => ({
                    nombre: tr.querySelector('.nombre').value, edad: tr.querySelector('.edad').value,
                    eps: tr.querySelector('.eps').value, sintoma_tos: tr.querySelector('.sintoma_tos').value,
                    sospecha: tr.querySelector('.sospecha').value, menor5: tr.querySelector('.menor5').value
                }));

                const payload = {
                    edit_id: editId || null, // INYECCIÓN UPSERT
                    fecha_visita: document.getElementById('fecha_visita').value,
                    territorio: document.getElementById('territorio').value,
                    microterritorio: document.getElementById('microterritorio').value,
                    codigo_familia: codFamInput.value,
                    municipio: document.getElementById('municipio').value,
                    barrio: document.getElementById('barrio').value,
                    direccion: document.getElementById('direccion').value,
                    latitud: document.getElementById('latitud').value || '0.0',
                    longitud: document.getElementById('longitud').value || '0.0',
                    nombre_profesional: document.getElementById('nombre_profesional').value,
                    registro_profesional: document.getElementById('reg_profesional').value,
                    nombre_jefe_hogar: document.getElementById('nombre_jefe').value,
                    doc_identidad: document.getElementById('doc_identidad').value,
                    telefono_contacto: document.getElementById('telefono').value,
                    total_integrantes: document.getElementById('total_integrantes').value,
                    familia_visita_no: document.getElementById('visita_no').value,

                    composicion_familiar: composicion,
                    riesgos_intradomiciliarios: {
                        humo: document.querySelector('input[name="r_humo"]:checked')?.value || 'NO',
                        hacinamiento: document.querySelector('input[name="r_hacinamiento"]:checked')?.value || 'NO',
                        alergenos: document.querySelector('input[name="r_alergenos"]:checked')?.value || 'NO',
                        humedad: document.querySelector('input[name="r_humedad"]:checked')?.value || 'NO',
                        tabaquismo: document.querySelector('input[name="r_tabaquismo"]:checked')?.value || 'NO',
                        ventilacion: document.querySelector('input[name="r_ventilacion"]:checked')?.value || 'NO',
                        observaciones: document.getElementById('obs_entorno').value
                    },
                    acciones_educacion: {
                        era_realizado: document.querySelector('input[name="edu_era_realizado"]:checked')?.value || 'NO',
                        era_nivel: document.querySelector('input[name="edu_era_nivel"]:checked')?.value || 'N/A',
                        inhalador_realizado: document.querySelector('input[name="edu_inhalador_realizado"]:checked')?.value || 'NO',
                        inhalador_nivel: document.querySelector('input[name="edu_inhalador_nivel"]:checked')?.value || 'N/A',
                        observaciones: document.getElementById('obs_educacion').value
                    },
                    seguimiento_era: {
                        nombre: document.getElementById('seg_nombre').value,
                        edad: document.getElementById('seg_edad').value,
                        estado: document.querySelector('input[name="seg_estado"]:checked')?.value || 'N/A',
                        gestion: document.querySelector('input[name="seg_gestion"]:checked')?.value || 'N/A',
                        ips: document.getElementById('seg_ips').value,
                        observacion: document.getElementById('seg_observacion').value
                    },
                    evidencias: evArr,
                    firma_profesional: canvasProf?.toDataURL('image/png'),
                    cc_profesional: document.getElementById('cc_profesional').value,
                    firma_cuidador: canvasCuid?.toDataURL('image/png'),
                    cc_cuidador: document.getElementById('cc_cuidador').value
                };

                const isOnline = typeof getNetworkState === 'function' ? getNetworkState() : navigator.onLine;

                if (isOnline) {
                    const res = await fetch('/api/respiratoria/save', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify(payload) });
                    const data = await res.json();
                    if(res.ok) {
                        alert(editId ? 'Actualizado.' : 'Guardado.'); window.location.href = `/api/respiratoria/${data.id}/pdf`;
                        setTimeout(() => window.location.replace('/registros'), 3500);
                    } else { alert(data.message); submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
                } else {
                    alert('Offline: Guardado local.');
                    let queue = JSON.parse(localStorage.getItem('aps_respiratoria_queue') || '[]'); queue.push(payload); localStorage.setItem('aps_respiratoria_queue', JSON.stringify(queue));
                    window.location.replace('/sincronizacion');
                }
            } catch (error) { console.error(error); alert('Error interno.'); submitBtn.disabled = false; }
        });
    }
});