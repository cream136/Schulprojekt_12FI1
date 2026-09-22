const button =
  document.getElementById("suchen");

const ergebnis =
  document.getElementById("ergebnis");


button.addEventListener(
  "click",
  async () => {
    const start =
      document
        .getElementById("start")
        .value
        .trim();

    const ziel =
      document
        .getElementById("ziel")
        .value
        .trim();


    if (!start || !ziel) {
      ergebnis.textContent =
        "Bitte Start und Ziel eingeben.";

      return;
    }


    ergebnis.textContent =
      "Route wird berechnet ...";


    try {
      console.log(
        "Stautracker API:",
        window.stautracker
      );

      if (!window.stautracker) {
        throw new Error(
          "preload.cjs wurde nicht geladen."
        );
      }


      const daten =
        await window.stautracker.routeSuchen(
          start,
          ziel
        );


      console.log(
        "Antwort:",
        daten
      );


      if (!daten.erfolg) {
        throw new Error(
          daten.fehler
        );
      }


      ergebnis.innerHTML = `
        <h2>Route</h2>

        <p>
          <strong>Start:</strong><br>
          ${daten.start.name}
        </p>

        <p>
          <strong>Ziel:</strong><br>
          ${daten.ziel.name}
        </p>

        <p>
          <strong>Entfernung:</strong>
          ${daten.kilometer} km
        </p>

        <p>
          <strong>Fahrzeit:</strong>
          ${daten.minuten} Minuten
        </p>
      `;

    } catch (error) {
      console.error(error);

      ergebnis.textContent =
        `Fehler: ${error.message}`;
    }
  }
);