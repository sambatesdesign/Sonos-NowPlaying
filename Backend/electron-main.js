const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const express = require('express');
const { SonosManager } = require('@svrooij/sonos');

let mainWindow;
let tray = null;
let server = null;

const appServer = express();
const port = 3000;
const manager = new SonosManager();
let discoveryInProgress = false;
let discoveryComplete = false;

appServer.use(express.json());

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
    title: 'Sonos Player - Backend Helper',
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
  if (server) {
    console.log('🛑 Stopping Express server...');
    server.close(() => {
      console.log('✅ Server stopped. Quitting app...');
      app.quit();
    });

    // Fallback timeout
    setTimeout(() => {
      console.warn('⚠️ Server did not close in time. Forcing quit...');
      app.exit(1);
    }, 3000);
  } else {
    app.quit();
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

async function ensureDiscovery() {
  if (!discoveryComplete && !discoveryInProgress) {
    discoveryInProgress = true;
    await manager.InitializeWithDiscovery();
    discoveryComplete = true;
    discoveryInProgress = false;
  }
}

// Routes
appServer.get('/players', async (req, res) => {
  try {
    await ensureDiscovery();
    const uniquePlayersMap = new Map();
    for (const device of manager.Devices) {
      if (!uniquePlayersMap.has(device.Name)) {
        uniquePlayersMap.set(device.Name, {
          name: device.Name,
          host: device.Host,
        });
      }
    }
    const uniquePlayers = Array.from(uniquePlayersMap.values());
    const logMsg = `🎙️ Found ${uniquePlayers.length} speaker(s)`;
    console.log(logMsg);
    sendToRenderer('log', logMsg);
    res.json(uniquePlayers);
  } catch (err) {
    console.error('Discovery failed:', err);
    sendToRenderer('log', `❌ Discovery failed: ${err}`);
    res.status(500).json({ error: err.toString() });
  }
});

appServer.get('/status', async (req, res) => {
  const { host } = req.query;
  if (!host) return res.status(400).json({ error: 'Missing host param' });

  try {
    await ensureDiscovery();
    const device = manager.Devices.find(d => d.Host === host);
    if (!device) return res.status(404).json({ error: 'Speaker not found for host: ' + host });

    const positionInfo = await device.AVTransportService.GetPositionInfo();
    const transportInfo = await device.AVTransportService.GetTransportInfo();
    const rawTitle = positionInfo.TrackMetaData?.Title || '';
    const relTime = positionInfo.RelTime || '0:00:00';
    const duration = positionInfo.TrackDuration || '0:00:00';
    const transportState = transportInfo.CurrentTransportState || 'UNKNOWN';

    const lowerTitle = rawTitle.toLowerCase();

    const bbcMap = {
      'bbc_radio_one.m3u8': { serviceId: 'bbc_radio_one', stationName: 'BBC Radio 1' },
      'bbc_radio_two.m3u8': { serviceId: 'bbc_radio_two', stationName: 'BBC Radio 2' },
      'bbc_radio_three.m3u8': { serviceId: 'bbc_radio_three', stationName: 'BBC Radio 3' },
      'bbc_radio_fourfm.m3u8': { serviceId: 'bbc_radio_fourfm', stationName: 'BBC Radio 4' },
      'bbc_radio_five_live.m3u8': { serviceId: 'bbc_radio_five_live', stationName: 'BBC Radio 5 Live' },
      'bbc_6music.m3u8': { serviceId: 'bbc_6music', stationName: 'BBC Radio 6 Music' }
    };

    const matchedStation = Object.keys(bbcMap).find(key => lowerTitle.includes(key));

    if (matchedStation) {
      const { serviceId, stationName } = bbcMap[matchedStation];
      const essUrl = `https://ess.api.bbci.co.uk/schedules?serviceId=${serviceId}`;

      try {
        const essRes = await fetch(essUrl);
        const essData = await essRes.json();

        const now = new Date();
        const currentShow = essData?.items?.find(item => {
          const start = new Date(item.published_time?.start);
          const end = new Date(item.published_time?.end);
          return start <= now && now <= end;
        });

        const showName = currentShow?.brand?.title || stationName;
        const presenter = currentShow?.episode?.title || '';

        const imageUrl = `https://mazespacestudios.com/bbc_radio/${serviceId}.png`;

        return res.json({
          title: showName,
          artist: presenter,
          albumArt: imageUrl,
          transportState,
          relTime,
          duration
        });
      } catch (err) {
        console.warn(`⚠️ ESS fetch failed for ${serviceId}:`, err.message);
      }
    }

    // Fallback to original metadata
    res.json({
      title: rawTitle || 'Unknown',
      artist: positionInfo.TrackMetaData?.Artist || '',
      albumArt: positionInfo.TrackMetaData?.AlbumArtUri || '',
      transportState,
      relTime,
      duration
    });
  } catch (err) {
    console.error('Status failed:', err);
    res.status(500).json({ error: err.toString() });
  }
});

appServer.post('/control', async (req, res) => {
  const { host, action } = req.body;
  const device = manager.Devices.find(d => d.Host === host);
  if (!device) return res.status(404).json({ error: 'Speaker not found' });

  try {
    switch (action) {
      case 'play': await device.Play(); break;
      case 'pause': await device.AVTransportService.Pause(); break;
      case 'next': await device.Next(); break;
      case 'previous': await device.Previous(); break;
      default: return res.status(400).json({ error: 'Invalid action' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Failed to ${action}:`, err.message);
    sendToRenderer('log', `❌ Control failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

appServer.post('/volume', async (req, res) => {
  const { host, volume } = req.body;
  const device = manager.Devices.find(d => d.Host === host);
  if (!device) return res.status(404).json({ error: 'Speaker not found' });

  try {
    await device.RenderingControlService.SetVolume({
      InstanceID: 0,
      Channel: 'Master',
      DesiredVolume: volume
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Failed to set volume:`, err.message);
    sendToRenderer('log', `❌ Set volume failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

appServer.get('/volume', async (req, res) => {
  const { host } = req.query;
  const device = manager.Devices.find(d => d.Host === host);
  if (!device) return res.status(404).json({ error: 'Speaker not found' });

  try {
    const response = await device.RenderingControlService.GetVolume({
      InstanceID: 0,
      Channel: 'Master'
    });
    const currentVolume = parseInt(response.CurrentVolume, 10);
    const logMsg = `📶 Current volume for ${host} is ${currentVolume}`;
    console.log(logMsg);
    sendToRenderer('log', logMsg);
    res.json({ volume: currentVolume });
  } catch (err) {
    console.error(`❌ Failed to get volume:`, err.message);
    sendToRenderer('log', `❌ Get volume failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();

  createWindow();
  createTray();

  const localIP = getLocalIP();
  mainWindow.webContents.on('did-finish-load', () => {
    sendToRenderer('ip', localIP);
    sendToRenderer('log', '✅ App Started');
  });

  setTimeout(() => {
    server = appServer.listen(port, () => {
      const msg = `Sonos backend listening on port ${port}`;
      console.log(msg);
      sendToRenderer('log', msg);
    });
  }, 1000);
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
