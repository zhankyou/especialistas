/**
 * ADMINISTRADOR DE IDENTIDADES FRONTEND (IAM)
 * Cliente RESTful con inyeccion de token Bearer (JWT)
 */

document.addEventListener('DOMContentLoaded', () => {
    const userRol = localStorage.getItem('rol') ? localStorage.getItem('rol').toUpperCase() : '';
    const token = localStorage.getItem('token');

    if (!token) {
        alert("Sesion invalida. Por favor inicie sesion.");
        window.location.replace('/login');
        return;
    }

    // RBAC Frontend: Ocultar boton de crear a Coordinador
    if(userRol !== 'ADMINISTRADOR') {
        const adminActs = document.getElementById('admin-actions');
        if(adminActs) adminActs.style.display = 'none';
    }

    fetchUsers();

    const formCreate = document.getElementById('form-create');
    if (formCreate) {
        formCreate.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const origText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

            const payload = {
                nombre: document.getElementById('crt_nombre').value,
                email: document.getElementById('crt_email').value,
                password: document.getElementById('crt_pass').value,
                rol: document.getElementById('crt_rol').value
            };

            try {
                const res = await fetch('/api/usuarios/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if(res.ok && data.status === 'success') {
                    closeModal('create-modal');
                    formCreate.reset();
                    fetchUsers();
                    if(window.AppDialog) window.AppDialog.alert('Exito', data.message); else alert(data.message);
                } else {
                    if(window.AppDialog) window.AppDialog.alert('Error', data.message); else alert(data.message);
                }
            } catch (err) {
                alert("Error de red. No se pudo procesar la solicitud.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origText;
            }
        });
    }

    const formPass = document.getElementById('form-pass');
    if (formPass) {
        formPass.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                user_id: document.getElementById('rst_id').value,
                new_password: document.getElementById('rst_pass').value
            };

            try {
                const res = await fetch('/api/usuarios/reset_password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if(res.ok && data.status === 'success') {
                    closeModal('pass-modal');
                    formPass.reset();
                    if(window.AppDialog) window.AppDialog.alert('Exito', "Contrasena actualizada exitosamente."); else alert("Contrasena actualizada.");
                } else {
                    if(window.AppDialog) window.AppDialog.alert('Error', data.message); else alert(data.message);
                }
            } catch(err) {
                alert("Error de red.");
            }
        });
    }

    window.openModal = id => {
        const modal = document.getElementById(id);
        if(modal) modal.classList.add('active');
    };

    window.closeModal = id => {
        const modal = document.getElementById(id);
        if(modal) modal.classList.remove('active');
    };

    async function fetchUsers() {
        const tbody = document.getElementById('users-body');
        if (!tbody) return;

        try {
            const res = await fetch('/api/usuarios/list', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const payload = await res.json();

            if(res.ok && payload.status === 'success') {
                renderUsers(payload.data);
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="color:#dc2626; text-align:center; padding: 20px;">Error Backend: ${payload.message || 'Desconocido'}</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:#dc2626; text-align:center; padding: 20px;">Fallo de conexion con Aiven PostgreSQL.</td></tr>`;
        }
    }

    function renderUsers(users) {
        const tbody = document.getElementById('users-body');
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">No hay registros disponibles.</td></tr>`;
            return;
        }

        users.forEach(u => {
            const currentRol = u.rol ? u.rol.toUpperCase() : 'DESCONOCIDO';
            const bClass = currentRol === 'ADMINISTRADOR' ? 'bdg-admin' : currentRol === 'COORDINADOR' ? 'bdg-coord' : 'bdg-dil';
            const stClass = u.is_blocked ? 'bdg-blocked' : 'bg-nut';
            const stText = u.is_blocked ? 'BLOQUEADO' : 'ACTIVO';
            const userNombre = u.nombre || u.email;

            let acts = '';
            if (userRol === 'ADMINISTRADOR') {
                if(u.is_blocked) {
                    acts += `<button class="btn-icon btn-unblock" onclick="window.toggleBlock('${u.id}', false)" title="Desbloquear"><i class="fas fa-unlock"></i></button>`;
                } else {
                    acts += `<button class="btn-icon btn-block" onclick="window.toggleBlock('${u.id}', true)" title="Bloquear Acceso"><i class="fas fa-ban"></i></button>`;
                }
                acts += `<button class="btn-icon btn-pass" onclick="window.openPassModal('${u.id}')" title="Resetear Contrasena"><i class="fas fa-key"></i></button>`;
                acts += `<button class="btn-icon btn-del" onclick="window.deleteUser('${u.id}')" title="Eliminar Permanente"><i class="fas fa-trash"></i></button>`;
            } else if (userRol === 'COORDINADOR') {
                if (u.is_blocked) {
                    acts += `<button class="btn-icon btn-unblock" onclick="window.toggleBlock('${u.id}', false)" title="Desbloquear"><i class="fas fa-unlock"></i> Restaurar</button>`;
                } else {
                    acts += `<span style="font-size:0.8rem; color:#94a3b8; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:5px;"><i class="fas fa-shield-alt"></i> Visualizacion</span>`;
                }
            }

            // Mitigacion XSS: textContent nativo mediante template iterativo seguro (sin innerHTML para datos crudos)
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${SecuritySanitizer(userNombre)}</strong><br><span style="font-size:0.75rem; color:#888;">ID: ${u.id.split('-')[0]}</span></td>
                <td>${SecuritySanitizer(u.email)}</td>
                <td><span class="badge ${bClass}">${SecuritySanitizer(currentRol)}</span></td>
                <td><span class="badge ${stClass}">${stText}</span></td>
                <td style="text-align:center;"><div class="action-btns" style="justify-content:center; display:flex; gap:10px;">${acts}</div></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Funcion auxiliar para escape de caracteres HTML (Prevencion XSS OWASP)
    function SecuritySanitizer(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    window.openPassModal = id => {
        const inputId = document.getElementById('rst_id');
        if(inputId) inputId.value = id;
        openModal('pass-modal');
    };

    window.toggleBlock = async (id, isBlocked) => {
        if(!confirm(`¿Esta seguro de ${isBlocked ? 'BLOQUEAR' : 'DESBLOQUEAR'} a este usuario?`)) return;
        try {
            const res = await fetch('/api/usuarios/toggle_block', {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify({user_id: id, is_blocked: isBlocked})
            });
            const data = await res.json();
            if(res.ok && data.status === 'success') {
                fetchUsers();
            } else {
                alert(data.message || 'Error en la operacion.');
            }
        } catch(e) {
            alert("Error de conexion de red.");
        }
    };

    window.deleteUser = async (id) => {
        if(!confirm(`PELIGRO: ¿Eliminar definitivamente al usuario? Esta accion destruye su acceso irrevocablemente y no se puede deshacer.`)) return;
        try {
            const res = await fetch('/api/usuarios/delete', {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify({user_id: id})
            });
            const data = await res.json();
            if(res.ok && data.status === 'success') {
                fetchUsers();
            } else {
                alert(data.message || 'No se pudo eliminar.');
            }
        } catch(e) {
            alert("Error de conexion de red.");
        }
    };
});