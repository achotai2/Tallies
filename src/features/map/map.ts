import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';

// Fix Leaflet's default icon path issues in bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const initMap = (container: HTMLElement) => {
  // Center map on a default location (e.g., world or specific region)
  const map = L.map(container).setView([-1.9441, 30.0619], 13); // Defaulting to Kigali, Rwanda as it seems relevant to previous context or just a placeholder

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Add GPS Button
  let gpsMarker: L.Marker | null = null;
  const gpsControl = new L.Control({ position: 'topleft' });
  gpsControl.onAdd = function() {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const button = L.DomUtil.create('a', '', div);
    button.innerHTML = '📍';
    button.href = '#';
    button.title = 'Snap to my location';
    button.style.backgroundColor = 'white';
    button.style.width = '30px';
    button.style.height = '30px';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.fontSize = '18px';
    button.style.textDecoration = 'none';
    button.style.color = 'black';

    L.DomEvent.on(button, 'click', function(e) {
      L.DomEvent.stop(e);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 16);
            if (gpsMarker) {
              gpsMarker.setLatLng([latitude, longitude]);
            } else {
              gpsMarker = L.marker([latitude, longitude]).addTo(map)
                .bindPopup('You are here');
            }
            gpsMarker.openPopup();
          },
          (error) => {
            console.error('Geolocation error:', error);
            alert('Could not get your location.');
          }
        );
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    });

    return div;
  };
  gpsControl.addTo(map);

  // Load Maps
  const loadMaps = async () => {
    try {
      const response = await fetch('/maps/index.json');
      if (!response.ok) return;
      const files: string[] = await response.json();

      const bounds = L.latLngBounds([]);

      for (const file of files) {
        try {
          const mapRes = await fetch(`/maps/${file}`);
          const blob = await mapRes.blob();
          let kmlString = '';

          if (file.endsWith('.kmz')) {
            const zip = await JSZip.loadAsync(blob);
            // Find .kml file
            const kmlFile = Object.values(zip.files).find(f => f.name.endsWith('.kml'));
            if (kmlFile) {
              kmlString = await kmlFile.async('string');
            }
          } else if (file.endsWith('.kml')) {
            kmlString = await blob.text();
          }

          if (kmlString) {
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(kmlString, 'text/xml');
            const geojson = toGeoJSON.kml(kmlDoc);
            const layer = L.geoJSON(geojson).addTo(map);
            bounds.extend(layer.getBounds());
          }

        } catch (err) {
          console.error(`Failed to load map ${file}:`, err);
        }
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds);
      }

    } catch (error) {
      console.error('Failed to load map index:', error);
    }
  };

  void loadMaps();

  // Ensure map is correctly sized once mounted
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
};
