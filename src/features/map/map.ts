import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import type { Bagup } from '../tally_session/types';

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

export const initMap = (container: HTMLElement): { cleanup: () => void; map: L.Map } => {
  // Center map on a default location (e.g., world or specific region)
  const map = L.map(container).setView([-1.9441, 30.0619], 13); // Defaulting to Kigali, Rwanda

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  let gpsMarker: L.CircleMarker | null = null;
  let userLocation: L.LatLng | null = null;
  let watchId: number | null = null;

  // Watch Position
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        userLocation = L.latLng(latitude, longitude);

        if (gpsMarker) {
          gpsMarker.setLatLng(userLocation);
        } else {
          gpsMarker = L.circleMarker(userLocation, {
            radius: 8,
            fillColor: '#FF0000',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map)
            .bindPopup('You are here');
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000
      }
    );
  }

  // Add GPS Button
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
      if (userLocation) {
        map.setView(userLocation, 16);
        if (gpsMarker) {
          gpsMarker.openPopup();
        }
      } else {
        alert('Location not available yet.');
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
            const layer = L.geoJSON(geojson, {
              onEachFeature: (feature, layer) => {
                if (feature.properties) {
                   let popupContent = '<div style="max-height: 200px; overflow-y: auto;"><table>';
                   const displayFields = ['name', 'description'];
                   for (const key of displayFields) {
                     if (feature.properties[key]) {
                       popupContent += `<tr><td><strong>${key}</strong></td><td>${feature.properties[key]}</td></tr>`;
                     }
                   }
                   popupContent += '</table></div>';
                   layer.bindPopup(popupContent);
                }
              }
            }).addTo(map);
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

  // Cleanup function
  const cleanup = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    map.remove();
  };

  return { cleanup, map };
};

export const addBagupMarkers = (map: L.Map, bagups: Bagup[], sessionName: string): void => {
  bagups.forEach((bagup) => {
    if (typeof bagup.lat === 'number' && typeof bagup.lng === 'number') {
      const date = new Date(bagup.created_at).toLocaleString();
      const speciesList = Object.entries(bagup.counts)
        .map(([code, count]) => `${code}: ${count}`)
        .join('<br>');

      const content = `<strong>${sessionName}</strong><br>
       Time: ${date}<br>
       Species:<br>${speciesList}`;

      L.circleMarker([bagup.lat, bagup.lng], {
        radius: 6,
        fillColor: '#3388ff',
        color: 'white',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .addTo(map)
        .bindPopup(content);
    }
  });
};
