const userRol = localStorage.getItem('rol');
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    // RBAC Frontend: Ocultar botón de crear a Coordinador
    if(userRol !== 'ADMINISTRADOR') {
        const adminActs = document.getElementById('admin-actions');
        if(adminActs) adminActs.style.display = 'none';
    }
    fetchUsers();

    document.getElementById('form-create').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando y Enviando Correo...';

        const payload = {
            nombre: document.getElementById('crt_nombre').value,
            email: document.getElementById('crt_email').value,
            password: document.getElementById('crt_pass').value,
            rol: document.getElementById('crt_rol').value
        };
        const res = await fetch('/api/usuarios/create', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify(payload)});
        const data = await res.json();

        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;

        if(res.ok) { closeModal('create-modal'); document.getElementById('form-create').reset(); fetchUsers(); alert(data.message); }
        else alert(data.message);
    });

    document.getElementById('form-pass').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = { user_id: document.getElementById('rst_id').value, new_password: document.getElementById('rst_pass').value };
        const res = await fetch('/api/usuarios/reset_password', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify(payload)});
        const data = await res.json();
        if(res.ok) { closeModal('pass-modal'); document.getElementById('form-pass').reset(); alert("Contraseña actualizada exitosamente."); }
        else alert(data.message);
    });
});

window.openModal = id => document.getElementById(id).classList.add('active');
window.closeModal = id => document.getElementById(id).classList.remove('active');

async function fetchUsers() {
    const tbody = document.getElementById('users-body');
    try {
        const res = await fetch('/api/usuarios/list', { headers: { 'Authorization': `Bearer ${token}` }});
        const payload = await res.json();
        if(res.ok) renderUsers(payload.data);
        else tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Error: ${payload.message}</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Fallo de conexión.</td></tr>`;
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-body');
    tbody.innerHTML = '';
    users.forEach(u => {
        const bClass = u.rol === 'ADMINISTRADOR' ? 'bdg-admin' : u.rol === 'COORDINADOR' ? 'bdg-coord' : 'bdg-dil';
        const stClass = u.is_blocked ? 'bdg-blocked' : 'bg-nut';
        const stText = u.is_blocked ? 'BLOQUEADO' : 'ACTIVO';

        let acts = '';
        if (userRol === 'ADMINISTRADOR') {
            if(u.is_blocked) acts += `<button class="btn-icon btn-unblock" onclick="toggleBlock('${u.id}', false)" title="Desbloquear"><i class="fas fa-unlock"></i></button>`;
            else acts += `<button class="btn-icon btn-block" onclick="toggleBlock('${u.id}', true)" title="Bloquear Acceso"><i class="fas fa-ban"></i></button>`;
            acts += `<button class="btn-icon btn-pass" onclick="openPassModal('${u.id}')" title="Resetear Contraseña"><i class="fas fa-key"></i></button>`;
            acts += `<button class="btn-icon btn-del" onclick="deleteUser('${u.id}')" title="Eliminar Permanente"><i class="fas fa-trash"></i></button>`;
        }
        // ARQUITECTURA RBAC: Segregación Estricta UI (Coordinador)
        else if (userRol === 'COORDINADOR') {
            if (u.is_blocked) {
                acts += `<button class="btn-icon btn-unblock" onclick="toggleBlock('${u.id}', false)" title="Desbloquear"><i class="fas fa-unlock"></i> Restaurar Acceso</button>`;
            } else {
                acts += `<span style="font-size:0.8rem; color:#94a3b8; font-weight:bold; display:flex; align-items:center; gap:5px;"><i class="fas fa-shield-alt"></i> Solo Desbloqueo</span>`;
            }
        }

        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td><strong>${u.nombre}</strong><br><span style="font-size:0.75rem; color:#888;">ID: ${u.id.split('-')[0]}</span></td>
                <td>${u.email}</td>
                <td><span class="badge ${bClass}">${u.rol}</span></td>
                <td><span class="badge ${stClass}">${stText}</span></td>
                <td style="text-align:center;"><div class="action-btns" style="justify-content:center;">${acts}</div></td>
            </tr>
        `);
    });
}

window.openPassModal = id => { document.getElementById('rst_id').value = id; openModal('pass-modal'); };

window.toggleBlock = async (id, isBlocked) => {
    if(!confirm(`¿Está seguro de ${isBlocked ? 'BLOQUEAR' : 'DESBLOQUEAR'} este usuario?`)) return;
    const res = await fetch('/api/usuarios/toggle_block', { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({user_id: id, is_blocked: isBlocked})});
    const data = await res.json();
    if(res.ok) fetchUsers(); else alert(data.message);
};

window.deleteUser = async (id) => {
    if(!confirm(`PELIGRO: ¿Eliminar definitivamente al usuario? Esta acción destruye su acceso irrevocablemente.`)) return;
    const res = await fetch('/api/usuarios/delete', { method: 'DELETE', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({user_id: id})});
    const data = await res.json();
    if(res.ok) fetchUsers(); else alert(data.message);
};