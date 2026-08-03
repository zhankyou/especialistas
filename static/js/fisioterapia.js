document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    
    // =========================================================================
    // ARQUITECTURA DE ENRUTAMIENTO: Detección de Modo Edición
    // =========================================================================
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit_id');

    // =========================================================================
    // 1. INYECCIÓN ESTÁTICA Y NORMALIZACIÓN DE CAMPOS
    // =========================================================================
    ['territorio', 'microterritorio'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let max = id === 'territorio' ? 64 : 3;
            let pref = id === 'territorio' ? 'T' : 'MT';
            for(let i = 1; i <= max; i++) {
                let opt = document.createElement('option');
                opt.value = opt.textContent = pref + i.toString().padStart(2,'0');
                el.appendChild(opt);
            }
        }
    });

    // MÁSCARA F0000 ESTRICTA (Defensa Frontend)
    const codFamInput = document.getElementById('codigo_familia');
    if (codFamInput) {
        codFamInput.addEventListener('input', function(e) {
            let val = this.value.toUpperCase();
            if (val.length > 0 && val[0] !== 'F') {
                val = 'F' + val.replace(/[^0-9]/g, '');
            } else if (val.length > 1) {
                val = 'F' + val.substring(1).replace(/[^0-9]/g, '');
            }
            this.value = val.substring(0, 5);
        });
    }

    // =========================================================================
    // 2. API DE GEOLOCALIZACIÓN NATIVA (ISO 27001 - Trazabilidad)
    // =========================================================================
    document.getElementById('btn-geo')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-geo');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localizando...';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    document.getElementById('latitud').value = pos.coords.latitude.toFixed(6);
                    document.getElementById('longitud').value = pos.coords.longitude.toFixed(6);
                    btn.innerHTML = '<i class="fas fa-check"></i> Capturado';
                    btn.style.background = '#16a34a';
                },
                (err) => {
                    console.error("Error GPS: ", err);
                    alert("Error: Permiso GPS denegado o señal débil.");
                    btn.innerHTML = '<i class="fas fa-satellite-dish"></i> Reintentar';
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } else {
            alert("Su navegador no soporta Geolocalización.");
            btn.innerHTML = '<i class="fas fa-satellite-dish"></i> Fallo';
        }
    });

    // =========================================================================
    // 3. CONSTRUCTOR DINÁMICO DE TABLAS (Sección 4 y otras)
    // =========================================================================
    const riesgosMap = {
        "Acceso / Entradas / Pasillos": ["Rampa ausente / Mal estado", "Pasillos estrechos/obstaculizados"],
        "Escaleras / Desniveles": ["Sin baranda/pasamanos", "Peldaños irregulares/resbalosos"],
        "Pisos y Superficies": ["Pisos resbaladizos", "Tapetes sueltos", "Cables expuestos"],
        "Baño / Sanitario / Ducha": ["Sin barras de agarre", "Sanitario bajo", "Espacio reducido"],
        "Iluminación/Espacio": ["Poca iluminación nocturna", "Obstáculos en áreas de tránsito"]
    };

    document.getElementById('add-barrera-btn')?.addEventListener('click', () => {
        const tbody = document.getElementById('barreras-body');
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>
                <select class="b-area form-control">
                    <option value="Acceso / Entradas / Pasillos">Acceso / Entradas / Pasillos</option>
                    <option value="Escaleras / Desniveles">Escaleras / Desniveles</option>
                    <option value="Pisos y Superficies">Pisos y Superficies</option>
                    <option value="Baño / Sanitario / Ducha">Baño / Sanitario / Ducha</option>
                    <option value="Iluminación/Espacio">Iluminación/Espacio</option>
                </select>
            </td>
            <td>
                <div class="table-checkbox-container b-riesgos-container"></div>
            </td>
            <td><input type="text" class="b-afecta form-control" placeholder="Ej: Adulto Mayor"></td>
            <td><input type="text" class="b-recom form-control" placeholder="Ej: Instalar barandas"></td>
            <td style="text-align:center;"><button type="button" class="btn-clear" onclick="this.closest('tr').remove()">X</button></td>
        `;

        const areaSelect = tr.querySelector('.b-area');
        const riesgosContainer = tr.querySelector('.b-riesgos-container');

        // Listener aislado a nivel de fila para popular checkboxes
        areaSelect.addEventListener('change', function() {
            const area = this.value;
            riesgosContainer.innerHTML = '';
            if(riesgosMap[area]) {
                riesgosMap[area].forEach(riesgo => {
                    riesgosContainer.insertAdjacentHTML('beforeend', `
                        <label class="table-checkbox-item">
                            <input type="checkbox" class="b-riesgo-check" value="${riesgo}"> 
                            <span>${riesgo}</span>
                        </label>
                    `);
                });
            }
        });

        areaSelect.dispatchEvent(new Event('change'));
        tbody.appendChild(tr);
    });

    document.getElementById('add-motor-btn')?.addEventListener('click', () => {
        document.getElementById('motor-body').insertAdjacentHTML('beforeend', `<tr>
            <td><input type="text" class="nm form-control"></td><td><input type="text" class="ed form-control"></td>
            <td><select class="ht form-control"><option>0-6m Control/Agarre</option><option>6-12m Sede/Gateo</option><option>12-24m Bipede/Marcha</option><option>2-5a Salto/Equilibrio</option></select></td>
            <td><select class="cp form-control"><option>SÍ</option><option>NO</option><option>Sospecha</option></select></td>
            <td><input type="text" class="al form-control"></td><td><input type="text" class="ac form-control"></td>
            <td style="text-align:center;"><button type="button" class="btn-clear" onclick="this.closest('tr').remove()">X</button></td></tr>`);
    });

    document.getElementById('add-caidas-btn')?.addEventListener('click', () => {
        document.getElementById('caidas-body').insertAdjacentHTML('beforeend', `<tr>
            <td><input type="text" class="nm form-control"></td><td><input type="text" class="ed form-control"></td>
            <td><input type="number" class="tg form-control" placeholder="s"></td><td><input type="number" class="un form-control" placeholder="s"></td>
            <td><select class="eq form-control"><option>Normal</option><option>Alterado</option></select></td>
            <td><select class="hc form-control"><option>Ninguna</option><option>1 caída</option><option>≥ 2 caídas</option></select></td>
            <td><select class="fr form-control"><option>NO</option><option>SÍ</option></select></td>
            <td><select class="cl form-control"><option>BAJO</option><option>MODERADO</option><option>ALTO</option></select></td>
            <td style="text-align:center;"><button type="button" class="btn-clear" onclick="this.closest('tr').remove()">X</button></td></tr>`);
    });

    document.getElementById('add-ergo-btn')?.addEventListener('click', () => {
        document.getElementById('ergo-body').insertAdjacentHTML('beforeend', `<tr>
            <td><input type="text" class="nm form-control"></td><td><input type="text" class="oc form-control"></td>
            <td><input type="text" class="rs form-control" placeholder="Ej: Carga, Postura"></td>
            <td><input type="text" class="st form-control" placeholder="Ej: Lumbalgia"></td>
            <td><select class="nv form-control"><option>Bajo</option><option>Medio</option><option>Alto</option></select></td>
            <td style="text-align:center;"><button type="button" class="btn-clear" onclick="this.closest('tr').remove()">X</button></td></tr>`);
    });

    // =========================================================================
    // 4. API CANVAS (FIRMAS) Y PROCESAMIENTO DE EVIDENCIAS
    // =========================================================================
    function initCanvas(id, clearId) {
        const c = document.getElementById(id), ctx = c?.getContext('2d');
        if(!ctx) return null;
        const rect = c.getBoundingClientRect();
        c.width = rect.width; c.height = 150;
        ctx.lineWidth=2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0a1f3d';
        let drawing=false;

        const pos = e => { e.preventDefault(); const b=c.getBoundingClientRect(); return [ (e.touches?e.touches[0].clientX:e.clientX)-b.left, (e.touches?e.touches[0].clientY:e.clientY)-b.top ]; };
        c.onmousedown = c.ontouchstart = e => { drawing=true; ctx.beginPath(); ctx.moveTo(...pos(e)); };
        c.onmousemove = c.ontouchmove = e => { if(drawing){ ctx.lineTo(...pos(e)); ctx.stroke(); }};
        c.onmouseup = c.ontouchend = () => drawing=false;
        document.getElementById(clearId).onclick = () => ctx.clearRect(0,0,c.width,c.height);
        return c;
    }
    const cvP = initCanvas('canvas-prof', 'clear-prof');
    const cvJ = initCanvas('canvas-jefe', 'clear-jefe');

    let evArr = [];
    document.getElementById('evidencia-file')?.addEventListener('change', async function(e) {
        evArr = await Promise.all(Array.from(e.target.files).slice(0,5).map(f => new Promise(r => {
            let rd = new FileReader(); rd.onload = ev => r({type:f.type, data:ev.target.result}); rd.readAsDataURL(f);
        })));
    });

    // =========================================================================
    // 5. DATA HYDRATION (POBLADO DE DATOS SI EXISTE EDIT_ID)
    // =========================================================================
    if (editId) {
        document.querySelector('.submit-btn').innerHTML = '<i class="fas fa-sync"></i> Actualizar Expediente y PDF';
        
        const headerTitle = document.querySelector('h2');
        if(headerTitle) headerTitle.innerHTML += ' <span style="color:#dc2626; font-size:0.8rem; background:#fee2e2; padding:3px 6px; border-radius:4px; vertical-align:middle; margin-left:10px;">MODO EDICIÓN</span>';

        fetch(`/api/registros/detalle/fisioterapia/${editId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(payload => {
            if (payload.status === 'success') {
                const data = payload.data;
                
                // Poblado de Campos de Texto
                const textFields = ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_fisio', 'reg_profesional', 'nombre_jefe', 'doc_identidad', 'telefono', 'total_integrantes', 'visita_no'];
                const dbFields = ['fecha_visita', 'territorio', 'microterritorio', 'codigo_familia', 'municipio', 'barrio', 'direccion', 'latitud', 'longitud', 'nombre_fisioterapeuta', 'registro_profesional', 'nombre_jefe_hogar', 'doc_identidad', 'telefono_contacto', 'total_integrantes', 'familia_visita_no'];
                
                textFields.forEach((id, index) => {
                    const el = document.getElementById(id);
                    if (el && data[dbFields[index]]) el.value = data[dbFields[index]];
                });

                if (document.getElementById('cc_profesional')) document.getElementById('cc_profesional').value = data.cc_profesional || '';
                if (document.getElementById('cc_jefe')) document.getElementById('cc_jefe').value = data.cc_jefe || '';

                // Poblado Tablas Dinámicas
                if (data.tamizaje_motor) {
                    data.tamizaje_motor.forEach(item => {
                        document.getElementById('add-motor-btn').click();
                        const lastRow = document.getElementById('motor-body').lastElementChild;
                        lastRow.querySelector('.nm').value = item.nm; lastRow.querySelector('.ed').value = item.ed;
                        lastRow.querySelector('.ht').value = item.ht; lastRow.querySelector('.cp').value = item.cp;
                        lastRow.querySelector('.al').value = item.al; lastRow.querySelector('.ac').value = item.ac;
                    });
                }
                
                if (data.riesgo_caidas) {
                    data.riesgo_caidas.forEach(item => {
                        document.getElementById('add-caidas-btn').click();
                        const lastRow = document.getElementById('caidas-body').lastElementChild;
                        lastRow.querySelector('.nm').value = item.nm; lastRow.querySelector('.ed').value = item.ed;
                        lastRow.querySelector('.tg').value = item.tg; lastRow.querySelector('.un').value = item.un;
                        lastRow.querySelector('.eq').value = item.eq; lastRow.querySelector('.hc').value = item.hc;
                        lastRow.querySelector('.fr').value = item.fr; lastRow.querySelector('.cl').value = item.cl;
                    });
                }

                if (data.riesgo_ergonomico) {
                    data.riesgo_ergonomico.forEach(item => {
                        document.getElementById('add-ergo-btn').click();
                        const lastRow = document.getElementById('ergo-body').lastElementChild;
                        lastRow.querySelector('.nm').value = item.nm; lastRow.querySelector('.oc').value = item.oc;
                        lastRow.querySelector('.rs').value = item.rs; lastRow.querySelector('.st').value = item.st;
                        lastRow.querySelector('.nv').value = item.nv;
                    });
                }

                // Constructor Avanzado de Barreras Arquitectónicas
                if (data.barreras_arquitectonicas) {
                    data.barreras_arquitectonicas.forEach(item => {
                        document.getElementById('add-barrera-btn').click();
                        const lastRow = document.getElementById('barreras-body').lastElementChild;
                        
                        const areaSelect = lastRow.querySelector('.b-area');
                        areaSelect.value = item.area;
                        areaSelect.dispatchEvent(new Event('change'));
                        
                        const container = lastRow.querySelector('.b-riesgos-container');
                        const savedRiesgos = (item.riesgos || '').split(' | ');
                        savedRiesgos.forEach(r => {
                            const cb = container.querySelector(`input[value="${r}"]`);
                            if(cb) cb.checked = true;
                        });
                        
                        lastRow.querySelector('.b-afecta').value = item.afecta || '';
                        lastRow.querySelector('.b-recom').value = item.recom || '';
                    });
                }

                // Poblado de Checkboxes, Radios y Módulos Fijos
                if (data.acciones_educacion) {
                    data.acciones_educacion.temas?.forEach(val => {
                        const cb = document.querySelector(`input[name="edu_tema"][value="${val}"]`);
                        if(cb) cb.checked = true;
                    });
                    data.acciones_educacion.herr?.forEach(val => {
                        const cb = document.querySelector(`input[name="edu_herr"][value="${val}"]`);
                        if(cb) cb.checked = true;
                    });
                }

                if (data.canalizacion) {
                    const reqRadio = document.querySelector(`input[name="can_req"][value="${data.canalizacion.requiere}"]`);
                    if(reqRadio) reqRadio.checked = true;
                    
                    data.canalizacion.servicio?.forEach(val => {
                        const cb = document.querySelector(`input[name="can_serv"][value="${val}"]`);
                        if(cb) cb.checked = true;
                    });
                    
                    document.getElementById('can_otro').value = data.canalizacion.servicio_otro || '';
                    
                    const prioRadio = document.querySelector(`input[name="can_prio"][value="${data.canalizacion.prioridad}"]`);
                    if(prioRadio) prioRadio.checked = true;
                    
                    document.getElementById('can_eps').value = data.canalizacion.eps || '';
                    document.getElementById('can_motivo').value = data.canalizacion.motivo || '';
                }

                if (data.sintesis_evidencias) {
                    const diagRadio = document.querySelector(`input[name="sin_diag"][value="${data.sintesis_evidencias.diag}"]`);
                    if(diagRadio) diagRadio.checked = true;
                    
                    document.getElementById('sin_diag_det').value = data.sintesis_evidencias.detalle_diag || '';
                    
                    data.sintesis_evidencias.plan?.forEach(val => {
                        const cb = document.querySelector(`input[name="sin_plan"][value="${val}"]`);
                        if(cb) cb.checked = true;
                    });
                    
                    document.getElementById('sin_revisita').value = data.sintesis_evidencias.revisita_dias || '';
                    
                    data.sintesis_evidencias.soportes?.forEach(val => {
                        const cb = document.querySelector(`input[name="sin_sop"][value="${val}"]`);
                        if(cb) cb.checked = true;
                    });
                    
                    if(data.sintesis_evidencias.metas) {
                        document.getElementById('meta_visita').value = data.sintesis_evidencias.metas.visita || '';
                        document.getElementById('meta_iec').checked = data.sintesis_evidencias.metas.iec || false;
                        document.getElementById('meta_can').checked = data.sintesis_evidencias.metas.canal || false;
                        const sesionRadio = document.querySelector(`input[name="meta_sesion"][value="${data.sintesis_evidencias.metas.sesion}"]`);
                        if(sesionRadio) sesionRadio.checked = true;
                    }
                }
                
                alert("Expediente cargado con éxito. Por normativas de auditoría, las firmas digitales han sido removidas. Por favor, firme nuevamente antes de guardar los cambios.");
            } else {
                alert(`Error al cargar datos: ${payload.message}`);
            }
        })
        .catch(err => console.error("Error hidratando DOM: ", err));
    }

    // =========================================================================
    // 6. CONTROL DE ENVÍO Y MANEJO GLOBAL DE ERRORES (UPSERT TRANSACTIONS)
    // =========================================================================
    const form = document.getElementById('fisio-form');
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const submitBtn = form.querySelector('.submit-btn');
            const originalBtnText = submitBtn.innerHTML;

            try {
                const codFam = document.getElementById('codigo_familia').value;
                if (!/^F\d{4}$/.test(codFam)) {
                    alert("Violación de formato: El Código de Familia debe ser 'F' seguido de 4 números (Ej: F0001).");
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ensamblando payload...';

                const barreras_payload = Array.from(document.querySelectorAll('#barreras-body tr')).map(tr => {
                    const checkedRiesgos = Array.from(tr.querySelectorAll('.b-riesgo-check:checked')).map(cb => cb.value).join(' | ');
                    return {
                        area: tr.querySelector('.b-area').value,
                        riesgos: checkedRiesgos || 'Sin riesgos',
                        afecta: tr.querySelector('.b-afecta').value || 'N/A',
                        recom: tr.querySelector('.b-recom').value || 'N/A'
                    };
                });

                const payload = {
                    edit_id: editId || null, // <-- Inyección Crítica para habilitar UPSERT en el Backend
                    
                    fecha_visita: document.getElementById('fecha_visita').value,
                    territorio: document.getElementById('territorio').value,
                    microterritorio: document.getElementById('microterritorio').value,
                    codigo_familia: codFam,
                    municipio: document.getElementById('municipio').value,
                    barrio: document.getElementById('barrio').value,
                    direccion: document.getElementById('direccion').value,
                    latitud: document.getElementById('latitud').value || '0.0',
                    longitud: document.getElementById('longitud').value || '0.0',
                    nombre_fisioterapeuta: document.getElementById('nombre_fisio').value,
                    registro_profesional: document.getElementById('reg_profesional').value,
                    nombre_jefe_hogar: document.getElementById('nombre_jefe').value,
                    doc_identidad: document.getElementById('doc_identidad').value,
                    telefono_contacto: document.getElementById('telefono').value,
                    total_integrantes: document.getElementById('total_integrantes').value,
                    familia_visita_no: document.getElementById('visita_no').value,

                    tamizaje_motor: Array.from(document.querySelectorAll('#motor-body tr')).map(tr => ({ nm: tr.querySelector('.nm').value, ed: tr.querySelector('.ed').value, ht: tr.querySelector('.ht').value, cp: tr.querySelector('.cp').value, al: tr.querySelector('.al').value, ac: tr.querySelector('.ac').value })),
                    riesgo_caidas: Array.from(document.querySelectorAll('#caidas-body tr')).map(tr => ({ nm: tr.querySelector('.nm').value, ed: tr.querySelector('.ed').value, tg: tr.querySelector('.tg').value, un: tr.querySelector('.un').value, eq: tr.querySelector('.eq').value, hc: tr.querySelector('.hc').value, fr: tr.querySelector('.fr').value, cl: tr.querySelector('.cl').value })),
                    riesgo_ergonomico: Array.from(document.querySelectorAll('#ergo-body tr')).map(tr => ({ nm: tr.querySelector('.nm').value, oc: tr.querySelector('.oc').value, rs: tr.querySelector('.rs').value, st: tr.querySelector('.st').value, nv: tr.querySelector('.nv').value })),
                    barreras_arquitectonicas: barreras_payload,

                    acciones_educacion: { temas: Array.from(document.querySelectorAll('input[name="edu_tema"]:checked')).map(c=>c.value), herr: Array.from(document.querySelectorAll('input[name="edu_herr"]:checked')).map(c=>c.value) },

                    canalizacion: {
                        requiere: document.querySelector('input[name="can_req"]:checked')?.value || 'NO',
                        servicio: Array.from(document.querySelectorAll('input[name="can_serv"]:checked')).map(c=>c.value),
                        servicio_otro: document.getElementById('can_otro').value,
                        prioridad: document.querySelector('input[name="can_prio"]:checked')?.value || '',
                        eps: document.getElementById('can_eps').value,
                        motivo: document.getElementById('can_motivo').value
                    },
                    sintesis_evidencias: {
                        diag: document.querySelector('input[name="sin_diag"]:checked')?.value || '',
                        detalle_diag: document.getElementById('sin_diag_det').value,
                        plan: Array.from(document.querySelectorAll('input[name="sin_plan"]:checked')).map(c=>c.value),
                        revisita_dias: document.getElementById('sin_revisita').value,
                        soportes: Array.from(document.querySelectorAll('input[name="sin_sop"]:checked')).map(c=>c.value),
                        metas: { visita: document.getElementById('meta_visita').value, iec: document.getElementById('meta_iec').checked, canal: document.getElementById('meta_can').checked, sesion: document.querySelector('input[name="meta_sesion"]:checked')?.value || 'No' }
                    },

                    evidencias: evArr,
                    firma_profesional: cvP?.toDataURL(),
                    cc_profesional: document.getElementById('cc_profesional').value,
                    firma_jefe: cvJ?.toDataURL(),
                    cc_jefe: document.getElementById('cc_jefe').value
                };

                // Uso de wrapper global getNetworkState() para pruebas de QA. Si no existe, fallback a navigator.onLine
                const isOnline = typeof getNetworkState === 'function' ? getNetworkState() : navigator.onLine;

                if (isOnline) {
                    const res = await fetch('/api/fisioterapia/save', { 
                        method:'POST', 
                        headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`}, 
                        body: JSON.stringify(payload) 
                    });
                    const data = await res.json();
                    
                    if (res.ok) {
                        alert(editId ? 'Expediente actualizado exitosamente. Inicializando PDF...' : 'Registro guardado. Inicializando PDF...');
                        window.location.href = `/api/fisioterapia/${data.id}/pdf`;
                        setTimeout(() => window.location.replace('/registros'), 3500);
                    } else {
                        alert(`Operación denegada: ${data.message}`);
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                } else {
                    alert('Modo Offline Detectado: Datos guardados en la caché local para sincronización diferida.');
                    saveOffline(payload);
                    window.location.replace('/sincronizacion');
                }

            } catch (error) {
                console.error("Fallo crítico frontend: ", error);
                alert('Error de procesamiento de datos en la Vista. Verifique la consola o intente nuevamente.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }

    function saveOffline(payload) {
        let queue = JSON.parse(localStorage.getItem('aps_fisioterapia_queue') || '[]');
        queue.push(payload);
        localStorage.setItem('aps_fisioterapia_queue', JSON.stringify(queue));
    }
});