// CekTeks untuk desktop: jendela Electron yang memuat CekTeks.html (semua pustaka tertanam, berjalan offline).
const { app, BrowserWindow, shell, session } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 360,
    minHeight: 560,
    title: "CekTeks",
    backgroundColor: "#f4f6f9",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  // Tautan ke luar (sumber, panduan, GitHub) dibuka di browser biasa, bukan di dalam aplikasi.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file:")) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  win.loadFile(path.join(__dirname, "app", "index.html"));
}

// Pengerasan keamanan: hanya izin yang dipakai CekTeks (papan klip, layar penuh) yang diberikan,
// dan halaman tidak boleh menyisipkan <webview> atau membuka jendela aplikasi baru.
const ALLOWED = new Set(["clipboard-read", "clipboard-sanitized-write", "fullscreen"]);
app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault());
});
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(ALLOWED.has(perm)));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => ALLOWED.has(perm));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
