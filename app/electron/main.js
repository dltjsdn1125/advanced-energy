// Minimal Electron wrapper — loads the statically exported Next app.
//
// Dev: `npm run dev` (Next on :4300) + `electron electron/main.js`
// Prod: `npm run build` → ./out, then launch this main.js with NODE_ENV=production.
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#FFFFFF",
    autoHideMenuBar: true,
    title: "AE Catalogue 2026",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    await win.loadURL("http://localhost:4300");
  } else {
    const indexPath = path.join(__dirname, "..", "out", "index.html");
    await win.loadFile(indexPath);
  }

  // Open external links in the OS browser instead of a new window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
