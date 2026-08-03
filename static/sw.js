/**
 * Service Worker PWA - APS ESE 2026
 * Arquitectura Híbrida: Optimización de recursos estáticos, protección estricta de PHI
 * y sanitización de protocolos de red (Defensa contra Extensiones).
 */

// BUMP DE VERSIÓN A v1.2.2 (Fuerza la purga del Caché Zombie y repara hilos rotos)
const CACHE_NAME = 'aps-cache-v1.2.2';

const ASSETS_TO_CACHE = [
    '/',
    '/login',
    '/dashboard',
    '/nuevo_registro',
    '/nutricion',
    '/respiratoria',
    '/fisioterapia',
    '/sincronizacion',
    '/static/css/global.css',
    '/static/css/dashboard.css',
    '/static/css/nutricion.css',
    '/static/css/cards.css',
    '/static/css/custom_alerts.css',
    '/static/js/layout.js',
    '/static/js/custom_alerts.js',
    '/static/js/nutricion.js',
    '/static/js/respiratoria.js',
    '/static/js/fisioterapia.js',
    '/static/js/sincronizacion.js',
    '/static/img/logo-aps.png',
    '/static/img/logo-ese.png',
    'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalación: Cachea los recursos estáticos y rutas maestras
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(`[ServiceWorker] Instalando motor PWA (${CACHE_NAME}) y cacheando core UI`);
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    // Fuerza al SW a tomar el control inmediatamente sin esperar a que se cierren las pestañas
    self.skipWaiting();
});

// Activación: Limpia cachés antiguos (Gestión de Ciclo de Vida)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[ServiceWorker] Purgando cache obsoleto:', name);
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Enrutador Dinámico de Peticiones (Estrategia Híbrida Segura)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 0. DEFENSA DE PROTOCOLO (Protocol Sanitization): 
    // Ignorar esquemas no soportados por Cache API (ej. chrome-extension://, file://, data:)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // 1. REGLA DE SEGURIDAD (ISO 27001): Bloqueo estricto de caché para la API transaccional.
    // Previene la fuga de Información de Salud Protegida (PHI)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Excluir peticiones transaccionales que alteran estado
    if (event.request.method !== 'GET') {
        return;
    }

    // 2. ESTRATEGIA CACHE-FIRST: Para recursos estáticos (CSS, JS, Imágenes, Fuentes)
    const isStaticAsset = url.pathname.startsWith('/static/') || url.hostname === 'fonts.googleapis.com' || url.hostname === 'cdnjs.cloudflare.com';
    
    if (isStaticAsset) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    // Solo cachear respuestas válidas y seguras
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 3. ESTRATEGIA NETWORK-FIRST CON FALLBACK A CACHÉ: Para vistas HTML y rutas maestras
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Solo cachear respuestas válidas y seguras
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});