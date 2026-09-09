/**
 * MOTOR GEOESPACIAL PWA - CLIENTE ES6
 * Implementa Leaflet.js, Autocompletado HTML5 Datalist y Parseo Defensivo de Coordenadas.
 */

class MapasEngine {
    constructor() {
        this.token = localStorage.getItem('token');
        this.userRole = localStorage.getItem('rol') ? localStorage.getItem('rol').trim().toUpperCase() : 'PROFESIONAL_APS';
        this.userEmail = localStorage.getItem('email') || '';

        this.map = null;
        this.markerLayerGroup = null;

        this.inputEmail = document.getElementById('map-email-filter');
        this.btnLoad = document.getElementById('btn-load-map');
        this.datalist = document.getElementById('email-suggestions');
        this.tableBody = document.getElementById('map-table-body');
    }

    init() {
        if (!this.token) {
            window.location.replace('/login');
            return;
        }

        // Restricción UX basada en Roles (RBAC Client-Side)
        if (this.inputEmail && this.userRole !== 'ADMINISTRADOR' && this.userRole !== 'COORDINADOR') {
            this.inputEmail.value = this.userEmail;
            this.inputEmail.disabled = true;
            this.inputEmail.title = "Políticas de privacidad: Solo puede visualizar sus propios registros territoriales.";
        } else {
            this.fetchEmailSuggestions();
        }

        this.initMap();
        this.bindEvents();
        this.fetchGeoData(); // Carga inicial
    }

    initMap() {
        this.map = L.map('map').setView([4.142, -73.626], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors | APS ESE 2026'
        }).addTo(this.map);

        this.markerLayerGroup = L.layerGroup().addTo(this.map);
    }

    bindEvents() {
        if (this.btnLoad) {
            this.btnLoad.addEventListener('click', () => {
                this.fetchGeoData();
            });
        }

        if (this.inputEmail) {
            this.inputEmail.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchGeoData();
            });
        }
    }

    async fetchEmailSuggestions() {
        try {
            const response = await fetch('/api/mapas/emails', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const result = await response.json();

            if (response.ok && result.status === 'success' && this.datalist) {
                this.datalist.innerHTML = '';
                result.data.forEach(email => {
                    const option = document.createElement('option');
                    option.value = email;
                    this.datalist.appendChild(option);
                });
            }
        } catch (error) {
            console.error('[MAPS WARN] Fallo al cargar autocompletado de correos.', error);
        }
    }

    async fetchGeoData() {
        const filterEmail = this.inputEmail ? this.inputEmail.value.trim() : '';

        const origText = this.btnLoad.innerHTML;
        this.btnLoad.disabled = true;
        this.btnLoad.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        try {
            const response = await fetch(`/api/mapas/geodata?email=${encodeURIComponent(filterEmail)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                this.plotMarkers(result.data);
                this.renderTable(result.data);
            } else {
                alert(`Error al cargar datos geoespaciales: ${result.message}`);
                this.renderTable([]);
            }
        } catch (error) {
            console.error('[MAPS NETWORK ERROR]', error);
            alert('Fallo de conexión al intentar obtener los puntos geográficos.');
        } finally {
            this.btnLoad.disabled = false;
            this.btnLoad.innerHTML = origText;
        }
    }

    /**
     * Sanitiza y estandariza cadenas de coordenadas corruptas (ej. "4.002758", comas, caracteres nulos)
     */
    parseCoordinate(coordString) {
        if (!coordString) return NaN;
        // Remueve comillas, espacios y convierte comas a puntos decimales estrictos
        const cleanString = String(coordString).replace(/['"°]/g, '').trim().replace(',', '.');
        return parseFloat(cleanString);
    }

    plotMarkers(geoDataList) {
        this.markerLayerGroup.clearLayers();
        const latLngBounds = [];

        if (!geoDataList || geoDataList.length === 0) {
            return;
        }

        geoDataList.forEach(point => {
            // Aplicación del parser defensivo para evitar que coordenadas como "4.0027" (String literal) desaparezcan
            const lat = this.parseCoordinate(point.latitud);
            const lng = this.parseCoordinate(point.longitud);

            if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

            let color = '#64748b';
            const modLow = point.modulo.toLowerCase();

            if (modLow === 'nutricion') color = '#10b981';
            else if (modLow === 'fisioterapia') color = '#f59e0b';
            else if (modLow === 'respiratoria') color = '#0ea5e9';

            const markerOptions = { radius: 8, fillColor: color, color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 0.8 };

            const popupContent = `
                <div style="font-family:'Sora',sans-serif; min-width:220px;">
                    <div style="background:${color}; color:white; padding:6px 10px; border-radius:4px 4px 0 0; font-weight:bold; font-size:0.85rem; text-transform:uppercase;">
                        ${point.modulo}
                    </div>
                    <div style="padding:12px; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 4px 4px; font-size:0.85rem; background:#ffffff;">
                        <strong>Familia:</strong> ${point.codigo_familia}<br>
                        <strong>Fecha:</strong> ${point.fecha_visita.split(' ')[0]}<br>
                        <strong>Lat/Lon:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>
                        <hr style="border:0; border-top:1px solid #e2e8f0; margin:10px 0;">
                        <a href="/${modLow}?view_id=${point.id}" target="_blank" style="display:inline-block; padding:6px 12px; background:#f1f5f9; color:var(--teal); text-decoration:none; font-weight:bold; border-radius:4px; border:1px solid #cbd5e1; width:100%; text-align:center; box-sizing:border-box;">
                            <i class="fas fa-external-link-alt"></i> Ver Formulario
                        </a>
                    </div>
                </div>
            `;

            const marker = L.circleMarker([lat, lng], markerOptions);
            marker.bindPopup(popupContent);

            this.markerLayerGroup.addLayer(marker);
            latLngBounds.push([lat, lng]);
        });

        if (latLngBounds.length > 0) {
            this.map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 16 });
        } else {
            // Regresa al centro estandar si no hay pines válidos
            this.map.setView([4.142, -73.626], 12);
        }
    }

    renderTable(geoDataList) {
        if (!this.tableBody) return;
        this.tableBody.innerHTML = '';

        if (!geoDataList || geoDataList.length === 0) {
            this.tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-map-marked-alt fa-2x"></i><br>No se encontraron coordenadas registradas para los filtros aplicados.</td></tr>`;
            return;
        }

        geoDataList.forEach(point => {
            // Mismo parseo estricto para la representación tabular
            const lat = this.parseCoordinate(point.latitud);
            const lng = this.parseCoordinate(point.longitud);

            const isInvalid = isNaN(lat) || isNaN(lng);
            const displayLat = isInvalid ? `<span style="color:#ef4444;">${point.latitud || 'Vacío'}</span>` : lat.toFixed(6);
            const displayLng = isInvalid ? `<span style="color:#ef4444;">${point.longitud || 'Vacío'}</span>` : lng.toFixed(6);

            const modLow = point.modulo.toLowerCase();
            let badgeColor = '#64748b';
            if(modLow === 'nutricion') badgeColor = '#10b981';
            else if(modLow === 'fisioterapia') badgeColor = '#f59e0b';
            else if(modLow === 'respiratoria') badgeColor = '#0ea5e9';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${point.fecha_visita.split(' ')[0]}</strong></td>
                <td><span style="background:${badgeColor}; color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${point.modulo.toUpperCase()}</span></td>
                <td style="font-family:monospace; font-weight:bold; color:var(--navy);">${point.codigo_familia}</td>
                <td style="color:#0369a1; font-weight:600; font-size:0.85rem;">${point.especialista_email}</td>
                <td style="font-family:monospace;">${displayLat}</td>
                <td style="font-family:monospace;">${displayLng}</td>
                <td style="text-align:center;">
                    <button class="btn-search-map" style="padding:6px 10px; font-size:0.8rem; margin:auto;" onclick="window.open('/${modLow}?view_id=${point.id}', '_blank')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            this.tableBody.appendChild(tr);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mapsEngine = new MapasEngine();
    mapsEngine.init();
});
