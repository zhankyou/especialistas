document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit_id');

    // Inicialización Dom Selects
    ['territorio', 'microterritorio'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let max = id === 'territorio' ? 64 : 3;
            let pref = id === 'territorio' ? 'T' : 'MT';
            for(let i=1; i<=max; i++) {
                let opt = document.createElement('option');
                opt.value = opt.textContent = pref + i.toString().padStart(2,'0');
                el.appendChild(opt);
            }
        }
    });

    const codFamInput = document.getElementById('codigo_familia');
    if (codFamInput) {
        codFamInput.addEventListener('input', function(e) {
            let val = this.value.toUpperCase();
            if (val.length > 0 && val[0] !== 'F') val = 'F' + val.replace(/[^0-9]/g, '');
            else if (val.length > 1) val = 'F' + val.substring(1).replace(/[^0-9]/g, '');
            this.value = val.substring(0, 5);
        });
    }

    document.getElementById('btn-geo')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-geo');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localizando...';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    document.getElementById('latitud').value = pos.coords.latitude.toFixed(6);
                    document.getElementById('longitud').value = pos.coords.longitude.toFixed(6);
                    btn.innerHTML = '<i class="fas fa-check"></i> Capturado'; btn.style.background = '#16a34a';
                },
                (err) => { alert("Error GPS."); btn.innerHTML = '<i class="fas fa-satellite-dish"></i> Reintentar'; },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else { alert("Navegador no soporta Geolocalización."); }
    });

    const tbody = document.getElementById('antropometria-body');
    document.getElementById('add-row-btn')?.addEventListener('click', () => {
        const rowCount = tbody.children.length + 1;
        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${rowCount}</td>
                <td><input type="text" class="nombre form-control" placeholder="Nombre completo"></td>
                <td><select class="condicion form-control"><option value="">Seleccione...</option><option value="<5 años">< 5 años</option><option value="Gestante">Gestante</option><option value="Ninguna">Ninguna</option></select></td>
                <td><input type="number" step="0.1" class="peso form-control" placeholder="0.0"></td>
                <td><input type="number" step="0.1" class="talla form-control" placeholder="0.0"></td>
                <td><input type="number" step="0.1" class="pb form-control" placeholder="0.0"></td>
                <td><select class="diagnostico form-control"><option value="">Seleccione...</option><option value="Desnutrición Aguda">Desnutrición Aguda</option><option value="Riesgo / Retraso">Riesgo / Retraso</option><option value="Peso Adecuado">Peso Adecuado</option><option value="Sobrepeso-Obesidad">Sobrepeso-Obesidad</option></select></td>
                <td><input type="text" class="eps form-control" placeholder="EPS"></td>
                <td style="text-align:center;"><button type="button" class="btn-clear" onclick="this.closest('tr').remove()">X</button></td>
            </tr>
        `);
    });

    function initCanvas(id, clearId) {
        const c = document.getElementById(id), ctx = c?.getContext('2d');
        if(!ctx) return null;
        c.width = c.getBoundingClientRect().width; c.height = 150;
        ctx.lineWidth=2; ctx.lineCap='round'; ctx.strokeStyle='#0a1f3d';
        let drawing=false;
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
        evArr = await Promise.all(Array.from(e.target.files).slice(0,5).map(f => new Promise(r => {
            let rd = new FileReader(); rd.onload = ev => r({type:f.type, data:ev.target.result}); rd.readAsDataURL(f);
        })));
    });

    // =========================================================================
    // ARQUITECTURA DATA HYDRATION - NUTRICIÓN
    // =========================================================================
    if (editId) {
        document.querySelector('.submit-btn').innerHTML = '<i class="fas fa-sync"></i> Actualizar Expediente y PDF';
        const headerTitle = document.querySelector('h2');
        if(headerTitle) headerTitle.innerHTML += ' <span style="color:#dc2626; font-size:0.8rem; background:#fee2e2; padding:3px 6px; border-radius:4px; vertical-align:middle; margin-left:10px;">MODO EDICIÓN</span>';

        fetch(`/api/registros/detalle/nutricion/${editId}`, { headers: { 'Authorization': `Bearer ${token}` }})
        .then(res => res.json())
        .then(payload => {
            if (payload.status === 'success') {
                const data = payload.data;
                const txtFields = ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_nutricionista', 'reg_profesional', 'nombre_jefe', 'doc_identidad', 'telefono', 'total_integrantes', 'visita_no'];
                const dbFields = ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_nutricionista', 'registro_profesional', 'nombre_jefe_hogar', 'doc_identidad', 'telefono_contacto', 'total_integrantes', 'familia_visita_no'];

                txtFields.forEach((id, i) => { const el = document.getElementById(id); if (el && data[dbFields[i]]) el.value = data[dbFields[i]]; });

                if (document.getElementById('cc_profesional')) document.getElementById('cc_profesional').value = data.cc_profesional || '';
                if (document.getElementById('cc_cuidador')) document.getElementById('cc_cuidador').value = data.cc_cuidador || '';

                if (data.antropometria) {
                    data.antropometria.forEach(item => {
                        document.getElementById('add-row-btn').click();
                        const lastRow = tbody.lastElementChild;
                        lastRow.querySelector('.nombre').value = item.nombre || '';
                        lastRow.querySelector('.condicion').value = item.condicion || '';
                        lastRow.querySelector('.peso').value = item.peso || '';
                        lastRow.querySelector('.talla').value = item.talla || '';
                        lastRow.querySelector('.pb').value = item.pb || '';
                        lastRow.querySelector('.diagnostico').value = item.diagnostico || '';
                        lastRow.querySelector('.eps').value = item.eps || '';
                    });
                }

                if (data.seguridad_alimentaria) {
                    const acc = document.querySelector(`input[name="acc_disp"][value="${data.seguridad_alimentaria.acceso}"]`); if(acc) acc.checked = true;
                    const con = document.querySelector(`input[name="consumo"][value="${data.seguridad_alimentaria.consumo}"]`); if(con) con.checked = true;
                    const hf = data.seguridad_alimentaria.percepcion_hfias ? 'SI' : 'NO';
                    const hfRad = document.querySelector(`input[name="hfias"][value="${hf}"]`); if(hfRad) hfRad.checked = true;
                }

                if (data.plan_cuidado) {
                    data.plan_cuidado.lineas?.forEach(v => { const cb = document.querySelector(`input[name="lineas_accion"][value="${v}"]`); if(cb) cb.checked=true; });
                    document.getElementById('lineas_otra').value = data.plan_cuidado.lineas_otra || '';
                    document.getElementById('compromiso').value = data.plan_cuidado.compromiso || '';
                }

                if (data.seguimiento) {
                    data.seguimiento.gestion?.forEach(v => { const cb = document.querySelector(`input[name="gestion_art"][value="${v}"]`); if(cb) cb.checked=true; });
                    data.seguimiento.soportes?.forEach(v => { const cb = document.querySelector(`input[name="soportes"][value="${v}"]`); if(cb) cb.checked=true; });
                }

                const remiteVal = data.remite ? 'SI' : 'NO';
                const remRad = document.querySelector(`input[name="remite"][value="${remiteVal}"]`); if(remRad) remRad.checked = true;

                alert("Expediente cargado con éxito. Por auditoría ISO 27001, debe refirmar el documento para aplicar cambios.");
            }
        });
    }

    const form = document.getElementById('nutricion-form');
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const submitBtn = form.querySelector('.submit-btn');
            const originalBtnText = submitBtn.innerHTML;

            try {
                if (!/^F\d{4}$/.test(codFamInput.value)) { alert("Formato incorrecto: F0000."); return; }

                submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

                const antropometria = Array.from(tbody.querySelectorAll('tr')).map(tr => ({
                    nombre: tr.querySelector('.nombre').value, condicion: tr.querySelector('.condicion').value,
                    peso: tr.querySelector('.peso').value, talla: tr.querySelector('.talla').value,
                    pb: tr.querySelector('.pb').value, diagnostico: tr.querySelector('.diagnostico').value,
                    eps: tr.querySelector('.eps').value
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
                    nombre_nutricionista: document.getElementById('nombre_nutricionista').value,
                    registro_profesional: document.getElementById('reg_profesional').value,
                    nombre_jefe_hogar: document.getElementById('nombre_jefe').value,
                    doc_identidad: document.getElementById('doc_identidad').value,
                    telefono_contacto: document.getElementById('telefono').value,
                    total_integrantes: document.getElementById('total_integrantes').value,
                    familia_visita_no: document.getElementById('visita_no').value,

                    antropometria: antropometria,
                    seguridad_alimentaria: {
                        acceso: document.querySelector('input[name="acc_disp"]:checked')?.value || '',
                        consumo: document.querySelector('input[name="consumo"]:checked')?.value || '',
                        percepcion_hfias: document.querySelector('input[name="hfias"]:checked')?.value === 'SI'
                    },
                    plan_cuidado: {
                        lineas: Array.from(document.querySelectorAll('input[name="lineas_accion"]:checked')).map(cb => cb.value),
                        lineas_otra: document.getElementById('lineas_otra').value,
                        compromiso: document.getElementById('compromiso').value
                    },
                    seguimiento: {
                        gestion: Array.from(document.querySelectorAll('input[name="gestion_art"]:checked')).map(cb => cb.value),
                        soportes: Array.from(document.querySelectorAll('input[name="soportes"]:checked')).map(cb => cb.value)
                    },
                    remite: document.querySelector('input[name="remite"]:checked')?.value === 'SI',

                    evidencias: evArr,
                    firma_profesional: canvasProf?.toDataURL('image/png'),
                    cc_profesional: document.getElementById('cc_profesional').value,
                    firma_cuidador: canvasCuid?.toDataURL('image/png'),
                    cc_cuidador: document.getElementById('cc_cuidador').value
                };

                const isOnline = typeof getNetworkState === 'function' ? getNetworkState() : navigator.onLine;

                if (isOnline) {
                    const res = await fetch('/api/nutricion/save', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify(payload) });
                    const data = await res.json();
                    if(res.ok) {
                        alert(editId ? 'Actualizado.' : 'Guardado.'); window.location.href = `/api/nutricion/${data.id}/pdf`;
                        setTimeout(() => window.location.replace('/registros'), 3500);
                    } else { alert(data.message); submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
                } else {
                    alert('Offline: Guardado local.');
                    let queue = JSON.parse(localStorage.getItem('aps_nutricion_queue') || '[]'); queue.push(payload); localStorage.setItem('aps_nutricion_queue', JSON.stringify(queue));
                    window.location.replace('/sincronizacion');
                }
            } catch (error) { console.error(error); alert('Error interno.'); submitBtn.disabled = false; }
        });
    }
});