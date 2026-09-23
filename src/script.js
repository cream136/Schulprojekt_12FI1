const button = document.getElementById("suchen");
const ergebnis = document.getElementById("ergebnis");

// Leaflet-Karte starten (Würzburg als Startansicht)
const map = L.map("map").setView([49.7913, 9.9534], 12);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let routeLayer = null;
let startMarker = null;
let zielMarker = null;

button.addEventListener("click", async () => {
  const start = document.getElementById("start").value.trim();
  const ziel = document.getElementById("ziel").value.trim();

  if (!start || !ziel) {
    ergebnis.textContent = "Bitte Start und Ziel eingeben.";
    return;
  }

  ergebnis.textContent = "Route wird berechnet ...";

  try {
    if (!window.stautracker) {
      throw new Error("Electron-Preload wurde nicht geladen.");
    }

    const daten = await window.stautracker.routeSuchen(start, ziel);
    console.log("ROUTENDATEN:", daten);

    if (!daten.erfolg) {
      throw new Error(daten.fehler);
    }

    ergebnis.innerHTML = `
      <h2>Route</h2>
      <p><strong>Start:</strong><br>${daten.start.name}</p>
      <p><strong>Ziel:</strong><br>${daten.ziel.name}</p>
      <p><strong>Entfernung:</strong> ${daten.kilometer} km</p>
      <p><strong>Fahrzeit:</strong> ${daten.minuten} Minuten</p>
    `;

    // Unterstützt lat/lon sowie latitude/longitude.
    const startLat = Number(daten.start.lat ?? daten.start.latitude);
    const startLon = Number(daten.start.lon ?? daten.start.lng ?? daten.start.longitude);
    const zielLat = Number(daten.ziel.lat ?? daten.ziel.latitude);
    const zielLon = Number(daten.ziel.lon ?? daten.ziel.lng ?? daten.ziel.longitude);

    if (![startLat, startLon, zielLat, zielLon].every(Number.isFinite)) {
      throw new Error("Die Routendaten enthalten keine gültigen Koordinaten.");
    }

    await routeAufKarteAnzeigen(startLat, startLon, zielLat, zielLon);
  } catch (error) {
    console.error(error);
    ergebnis.textContent = `Fehler: ${error.message}`;
  }
});

async function routeAufKarteAnzeigen(startLat, startLon, zielLat, zielLon) {
  const url =
    "https://router.project-osrm.org/route/v1/driving/" +
    `${startLon},${startLat};${zielLon},${zielLat}` +
    "?overview=full&geometries=geojson";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Route für die Karte konnte nicht geladen werden.");
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("OSRM konnte keine Route finden.");
  }

  if (routeLayer) map.removeLayer(routeLayer);
  if (startMarker) map.removeLayer(startMarker);
  if (zielMarker) map.removeLayer(zielMarker);

  startMarker = L.marker([startLat, startLon])
    .addTo(map)
    .bindPopup("Start");

  zielMarker = L.marker([zielLat, zielLon])
    .addTo(map)
    .bindPopup("Ziel");

  routeLayer = L.geoJSON(data.routes[0].geometry).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
}
