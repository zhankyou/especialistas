/**
 * CORE LAYOUT ENGINE - APS ESE 2026
 * Arquitectura Frontend: Responsabilidad Única, RBAC UI, Gestión de Sesión (ISO 27001),
 * Inmunidad XSS, Red Nativa PWA y Control de Versiones en Caché.
 */

class LayoutEngine {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userEmail = localStorage.getItem('email');
        this.userRol = localStorage.getItem('rol') || 'DILIGENCIADOR';
    }

    init() {
        this.initSession();
        this.initRBAC();
        this.initSidebar();
        this.initNetworkState();
        this.initCacheManager();
    }

    /**
     * 1. Gestión de Sesión y Autenticación Segura
     */
    initSession() {
        const emailDisplay = document.getElementById('user-display-email');
        if (emailDisplay && this.userEmail) {
            emailDisplay.replaceChildren();

            const emailText = document.createTextNode(this.userEmail);
            const lineBreak = document.createElement('br');
            const roleSpan = document.createElement('span');

            roleSpan.style.cssText = 'font-size:0.7rem; color:var(--teal); font-weight:bold;';
            roleSpan.textContent = `[${this.userRol}]`;

            emailDisplay.appendChild(emailText);
            emailDisplay.appendChild(lineBreak);
            emailDisplay.appendChild(roleSpan);
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async (e) => {
                e.preventDefault();

                let confirmado = true;
                if (window.AppDialog && typeof window.AppDialog.confirm === 'function') {
                    confirmado = await window.AppDialog.confirm(
                        'Cerrar Sesión',
                        '¿Está seguro de que desea cerrar la sesión actual? Se purgarán las credenciales locales de forma segura.'
                    );
                }

                if (confirmado) {
                    this.clearSessionAndRedirect();
                }
            });
        }
    }

    clearSessionAndRedirect() {
        localStorage.removeItem('token');
        localStorage.removeItem('email');
        localStorage.removeItem('rol');
        sessionStorage.clear();
        window.location.replace('/login');
    }

    /**
     * 2. Arquitectura RBAC (UI Frontend Whitelisting)
     */
    initRBAC() {
        const menuIam = document.getElementById('menu-iam');
        if (menuIam && (this.userRol === 'ADMINISTRADOR' || this.userRol === 'COORDINADOR')) {
            menuIam.style.display = 'block';
        }
    }

    /**
     * 3. Control del DOM: Navigation Drawer Responsivo
     */
    initSidebar() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');

        if (sidebarToggle && sidebar && sidebarOverlay) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                sidebarOverlay.classList.toggle('active');
            });

            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });
        }
    }

    /**
     * 4. Gestión Quirúrgica del Purgado de Caché del Service Worker
     */
    initCacheManager() {
        const btnClearCache = document.getElementById('btn-clear-cache');
        if (btnClearCache) {
            const newBtnClearCache = btnClearCache.cloneNode(true);
            btnClearCache.parentNode.replaceChild(newBtnClearCache, btnClearCache);

            newBtnClearCache.addEventListener('click', async (e) => {
                e.preventDefault();

                let confirmado = true;
                if (window.AppDialog && typeof window.AppDialog.confirm === 'function') {
                    confirmado = await window.AppDialog.confirm(
                        'Actualizar Sistema',
                        '¿Desea forzar la descarga de la última versión de la aplicación? Sus registros médicos en cola de sincronización NO se perderán.'
                    );
                }

                if (!confirmado) return;

                try {
                    if ('caches' in window) {
                        const cacheKeys = await caches.keys();
                        await Promise.all(cacheKeys.map(key => caches.delete(key)));
                    }

                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let registration of registrations) {
                            await registration.unregister();
                        }
                    }

                    window.location.reload(true);

                } catch (error) {
                    console.error('ERROR CRITICO: Fallo al purgar la caché de la PWA:', error);
                    if (window.AppDialog && typeof window.AppDialog.alert === 'function') {
                        window.AppDialog.alert('Error', 'No se pudo vaciar la caché. Intente reiniciar el navegador.');
                    }
                }
            });
        }
    }

    /**
     * 5. Arquitectura PWA: Gestión de Estado de Red Nivel Hardware
     */
    initNetworkState() {
        const indicator = document.getElementById('offline-indicator');

        const updateStatus = async (isInitial = false) => {
            const isOnline = navigator.onLine;

            if (indicator) {
                indicator.style.display = isOnline ? 'none' : 'block';
            }

            if (!isInitial && window.AppDialog && typeof window.AppDialog.alert === 'function') {
                if (!isOnline) {
                    await window.AppDialog.alert(
                        'Conexión Perdida',
                        'Ha perdido la conexión a Internet. El sistema continuará operando en modo fuera de línea local.'
                    );
                } else {
                    await window.AppDialog.alert(
                        'Conexión Restablecida',
                        'Se ha recuperado la conexión a la red. Puede proceder con la sincronización de sus registros.'
                    );
                }
            }
        };

        window.addEventListener('online', () => updateStatus(false));
        window.addEventListener('offline', () => updateStatus(false));

        updateStatus(true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const layoutApp = new LayoutEngine();
    layoutApp.init();
});

function getNetworkState() {
    return navigator.onLine;
}