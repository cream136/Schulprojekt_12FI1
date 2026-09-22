const {
  contextBridge,
  ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
  "stautracker",
  {
    routeSuchen: (start, ziel) =>
      ipcRenderer.invoke(
        "route-suchen",
        start,
        ziel
      )
  }
);