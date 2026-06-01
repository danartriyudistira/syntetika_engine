const { app, BrowserWindow, session, dialog, Menu } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 8000;
const ROOT = __dirname;
const isDev = !app.isPackaged;

// --- HTTP Server ---
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".isf": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".cmd": "text/plain",
  ".md": "text/markdown; charset=utf-8",
};

function serveFile(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.join(ROOT, urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    res.end(data);
  });
}

let server;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(serveFile);
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`HTTP server running on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });
}

// --- OSC Bridge (optional) ---
let oscProcess = null;

function startOscBridge() {
  const oscPath = path.join(ROOT, "osc-bridge.js");
  if (!fs.existsSync(oscPath)) return;
  oscProcess = spawn("node", [oscPath], {
    stdio: "ignore",
    detached: false,
  });
  oscProcess.on("error", () => { oscProcess = null; });
}

// --- Window ---
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: "Syntetika Engine",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // MIDI permission
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "midi" || permission === "midiSysex") {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      require("electron").shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- Menu ---
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open DevTools",
          accelerator: "Ctrl+Shift+I",
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- App Lifecycle ---
app.whenReady().then(async () => {
  createMenu();
  await startServer();
  // startOscBridge(); // uncomment to auto-launch OSC bridge
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (server) server.close();
  if (oscProcess) oscProcess.kill();
});
