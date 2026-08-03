document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de Seguridad y Sesión
    const token = localStorage.getItem('token');
    const expiresAt = localStorage.getItem('expires_at');
    const userEmail = localStorage.getItem('email');

    // Validación estricta: Si no hay token o expiró, redirigir al login
    if (!token || !expiresAt) {
        window.location.replace('/login');
        return;
    }

    const now = new Date().getTime();
    if (now >= parseInt(expiresAt, 10)) {
        localStorage.clear();
        window.location.replace('/login');
        return;
    }

    // Renderizado seguro de credenciales
    if (userEmail) {
        const userDisplay = document.getElementById('user-display-email');
        if (userDisplay) {
            userDisplay.textContent = userEmail; // textContent previene ataques XSS
        }
    }

    // Lógica de Cierre de Sesión Seguro
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace('/login');
        });
    }

    // 2. Control de Interfaz: Off-Canvas Menu para Móviles
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebarToggle && sidebar && overlay) {
        // Abrir/Cerrar menú desde el botón hamburguesa
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        // Cerrar menú al tocar el área oscura (Overlay)
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
});