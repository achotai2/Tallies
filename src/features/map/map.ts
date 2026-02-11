import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
// Assuming this type exists in your project
import type { Bagup } from '../tally_session/types'; 

// --- FIX LEAFLET ICONS (The Safe Way) ---
// We use the Unpkg CDN to load standard markers so we don't fight with the bundler.
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;


export const initMap = (container: HTMLElement): { cleanup: () => void; map: L.Map } => {
  // Center map on a default location (e.g., world or specific region)
  const map = L.map(container).setView([-1.9441, 30.0619], 13); // Defaulting to Kigali, Rwanda

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  let gpsMarker: L.CircleMarker | null = null;
  let userLocation: L.LatLng | null = null;
  let watchId: number | null = null;

  // --- 1. GPS TRACKING (The "Blue Dot") ---
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        userLocation = L.latLng(latitude, longitude);

        if (gpsMarker) {
          gpsMarker.setLatLng(userLocation);
        } else {
          // Create the "You are Here" blue dot
          gpsMarker = L.circleMarker(userLocation, {
            radius: 8,
            fillColor: '#3388ff', // Standard "Blue Dot" color
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map);
          
          gpsMarker.bindPopup("You are here");
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  }

  // --- 2. GPS BUTTON (Zoom to me) ---
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
    button.style.cursor = 'pointer';

    L.DomEvent.on(button, 'click', function(e) {
      L.DomEvent.stop(e);
      if (userLocation) {
        map.flyTo(userLocation, 16); // flyTo is smoother than setView
        if (gpsMarker) {
          gpsMarker.openPopup();
        }
      } else {
        alert('Waiting for GPS signal...');
      }
    });

    return div;
  };
  gpsControl.addTo(map);

  // --- 3. LOAD MAPS (KML/KMZ) ---
  const loadMaps = async () => {
    try {
      const response = await fetch('/maps/index.json');
      if (!response.ok) return;
      const files: string[] = await response.json();

      const bounds = L.latLngBounds([]);
      let hasLayers = false;

      for (const file of files) {
        try {
          const mapRes = await fetch(`/maps/${file}`);
          const blob = await mapRes.blob();
          let kmlString = '';

          // Handle KMZ vs KML
          if (file.endsWith('.kmz')) {
            const zip = await JSZip.loadAsync(blob);
            // Find the first .kml file inside the zip
            const kmlFilename = Object.keys(zip.files).find(name => name.endsWith('.kml'));
            if (kmlFilename) {
              kmlString = await zip.files[kmlFilename].async('string');
            }
          } else if (file.endsWith('.kml')) {
            kmlString = await blob.text();
          }

          if (kmlString) {
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(kmlString, 'text/xml');
            const geojson = toGeoJSON.kml(kmlDoc);
            
            const layer = L.geoJSON(geojson, {
              // --- DYNAMIC POPUPS FOR ALL DATA ---
              onEachFeature: (feature, layer) => {
                if (feature.properties) {
                   let popupContent = '<div style="max-height: 200px; overflow-y: auto;"><h4>Info</h4><ul>';
                   // Loop through EVERY property in the KML data
                   Object.keys(feature.properties).forEach(key => {
                       // Skip empty values or complex objects
                       const val = feature.properties![key];
                       if(val !== null && typeof val !== 'object') {
                           popupContent += `<li><strong>${key}:</strong> ${val}</li>`;
                       }
                   });
                   popupContent += '</ul></div>';
                   layer.bindPopup(popupContent);
                }
              },
              // Optional: Style your polygons here
              style: {
                  color: '#ff7800',
                  weight: 2,
                  opacity: 0.65
              }
            }).addTo(map);
            
            bounds.extend(layer.getBounds());
            hasLayers = true;
          }

        } catch (err) {
          console.error(`Failed to load map ${file}:`, err);
        }
      }

      if (hasLayers && bounds.isValid()) {
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

// --- 4. BAGUP MARKERS (Red Dots) ---
export const addBagupMarkers = (map: L.Map, bagups: Bagup[], sessionName: string): void => {
  // We use CircleMarkers instead of an external SVG icon to prevent 404 errors.
  // These will be distinct RED dots.
  
  bagups.forEach((bagup) => {
    if (typeof bagup.lat === 'number' && typeof bagup.lng === 'number') {
      const date = new Date(bagup.created_at).toLocaleString();
      
      // Format the species list for the popup
      const speciesList = Object.entries(bagup.counts)
        .map(([code, count]) => `<b>${code}:</b> ${count}`)
        .join('<br>');

      const content = `<div style="text-align:center">
        <strong>${sessionName}</strong><br>
        <small>${date}</small>
        <hr style="margin: 5px 0;">
        ${speciesList || 'No counts'}
        </div>`;

      // Create a Red Circle Marker for the Bagup
      L.circleMarker([bagup.lat, bagup.lng], {
          radius: 6,
          fillColor: '#ff0000', // Red for Data
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
      })
      .addTo(map)
      .bindPopup(content);
    }
  });
};