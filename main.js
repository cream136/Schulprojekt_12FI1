import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,

    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.cjs"
      ),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("src/index.html");

  // Vorübergehend zum Debuggen
  win.webContents.openDevTools();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// --------------------------------------------------
// JSON per Node HTTPS laden
// --------------------------------------------------

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    console.log("HTTP-Aufruf:");
    console.log(url);

    const request = https.get(
      url,
      {
        headers
      },
      response => {
        console.log(
          "HTTP Status:",
          response.statusCode
        );

        let body = "";

        response.on("data", chunk => {
          body += chunk;
        });

        response.on("end", () => {
          if (
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            reject(
              new Error(
                `HTTP Fehler ${response.statusCode}`
              )
            );

            return;
          }

          try {
            const data = JSON.parse(body);

            resolve(data);
          } catch (error) {
            reject(
              new Error(
                "Antwort konnte nicht als JSON gelesen werden."
              )
            );
          }
        });
      }
    );

    request.on("error", error => {
      console.error("HTTPS FEHLER:");
      console.error(error);

      reject(error);
    });

    request.end();
  });
}


// --------------------------------------------------
// Nominatim
// --------------------------------------------------

async function geocode(adresse) {
  const params = new URLSearchParams({
    q: adresse,
    format: "jsonv2",
    limit: "1",
    countrycodes: "de"
  });

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    params.toString();

  console.log("\nNOMINATIM:");
  console.log(adresse);

  const data = await getJson(
    url,
    {
      "User-Agent":
        "Stautracker-Schulprojekt/1.0",
      "Accept-Language":
        "de-DE,de;q=0.9"
    }
  );

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Adresse nicht gefunden: ${adresse}`
    );
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    name: data[0].display_name
  };
}


// --------------------------------------------------
// OSRM
// --------------------------------------------------

async function routeBerechnen(start, ziel) {
  const koordinaten =
    `${start.lon},${start.lat};` +
    `${ziel.lon},${ziel.lat}`;

  const url =
    "https://router.project-osrm.org/" +
    `route/v1/driving/${koordinaten}` +
    "?overview=false";

  console.log("\nOSRM:");

  const data = await getJson(url);

  if (data.code !== "Ok") {
    throw new Error(
      `OSRM Fehler: ${data.code}`
    );
  }

  if (
    !data.routes ||
    data.routes.length === 0
  ) {
    throw new Error(
      "Es wurde keine Route gefunden."
    );
  }

  return data.routes[0];
}


// --------------------------------------------------
// Electron IPC
// --------------------------------------------------

ipcMain.handle(
  "route-suchen",

  async (
    event,
    startAdresse,
    zielAdresse
  ) => {
    try {
      console.log("\n======================");
      console.log("NEUE ROUTENSUCHE");
      console.log(startAdresse);
      console.log("→");
      console.log(zielAdresse);
      console.log("======================");

      if (
        !startAdresse?.trim() ||
        !zielAdresse?.trim()
      ) {
        throw new Error(
          "Bitte Start und Ziel eingeben."
        );
      }

      const start = await geocode(
        startAdresse.trim()
      );

      console.log(
        "Start gefunden:",
        start
      );

      // Nominatim nicht zu schnell erneut anfragen
      await sleep(1100);

      const ziel = await geocode(
        zielAdresse.trim()
      );

      console.log(
        "Ziel gefunden:",
        ziel
      );

      const route =
        await routeBerechnen(
          start,
          ziel
        );

      console.log(
        "Route gefunden:",
        route.distance,
        route.duration
      );

      return {
        erfolg: true,

        start,
        ziel,

        kilometer:
          (
            route.distance / 1000
          ).toFixed(1),

        minuten:
          Math.round(
            route.duration / 60
          )
      };

    } catch (error) {
      console.error(
        "\nROUTENFEHLER:"
      );

      console.error(error);

      return {
        erfolg: false,
        fehler:
          error.message
      };
    }
  }
);


// --------------------------------------------------
// Electron starten
// --------------------------------------------------

app.whenReady().then(() => {
  createWindow();
});

app.on(
  "window-all-closed",
  () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }
);