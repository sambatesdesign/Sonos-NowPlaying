const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
let tray = null;
let backend = null;

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'Unknown';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 550,
    height: 500,
    title: 'Sonos Player Backend',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('ui.html');

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function sendToRenderer(channel, msg) {
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.webContents &&
    !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send(channel, msg);
  }
}

function quitApp() {
  if (backend) {
    console.log('🛑 Killing backend process...');
    backend.on('exit', () => {
      console.log('✅ Backend terminated, exiting app.');
      app.exit(0);
    });

    backend.kill('SIGTERM');

    setTimeout(() => {
      console.warn('⚠️ Backend did not exit in time. Forcing quit.');
      app.exit(1);
    }, 3000);
  } else {
    app.exit(0);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'sonos-icon.png');
  let icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    console.warn('⚠️ Tray icon failed to load. Using default system icon.');
    icon = nativeImage.createFromNamedImage('NSApplicationIcon', []);
  }

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Logs', click: () => mainWindow.show() },
    { label: 'Quit', click: () => quitApp() }
  ]);

  tray.setToolTip('Sonos Player');
  tray.setContextMenu(contextMenu);
}

function startBackend() {
  backend = spawn('node', [path.join(__dirname, 'main.js')]);

  backend.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    console.log('[Backend]', msg);
    sendToRenderer('log', msg);
  });

  backend.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.error('[Backend ERROR]', msg);
    sendToRenderer('log', `❌ ${msg}`);
  });

  backend.on('close', (code) => {
    const exitMsg = `⚠️ Backend exited with code ${code}`;
    console.warn(exitMsg);
    sendToRenderer('log', exitMsg);
  });
}

app.whenReady().then(() => {
  // 👇 Hide dock icon (macOS only)
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  createWindow();
  createTray();
  startBackend();

  const localIP = getLocalIP();
  mainWindow.webContents.on('did-finish-load', () => {
    sendToRenderer('ip', localIP);
    sendToRenderer('log', '✅ App Started');
  });
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
