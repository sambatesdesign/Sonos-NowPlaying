const express = require('express');
const { SonosManager } = require('@svrooij/sonos');

const app = express();
const port = 3000;
const manager = new SonosManager();

let discoveryInProgress = false;
let discoveryComplete = false;

app.use(express.json());

const ensureDiscovery = async () => {
  if (!discoveryComplete && !discoveryInProgress) {
    discoveryInProgress = true;
    await manager.InitializeWithDiscovery();
    discoveryComplete = true;
    discoveryInProgress = false;
  }
};

app.get('/players', async (req, res) => {
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

    console.log('Filtered unique players:', uniquePlayers);

    res.json(uniquePlayers);
  } catch (err) {
    console.error('Discovery failed:', err);
    res.status(500).json({ error: err.toString() });
  }
});

app.get('/status', async (req, res) => {
  const { host } = req.query;
  if (!host) return res.status(400).json({ error: 'Missing host param' });

  try {
    await ensureDiscovery();

    if (manager.Devices.length === 0) {
      return res.status(500).json({ error: 'No Devices available!' });
    }

    const device = manager.Devices.find(d => d.Host === host);
    if (!device) return res.status(404).json({ error: 'Speaker not found for host: ' + host });

    const positionInfo = await device.AVTransportService.GetPositionInfo();
    const transportInfo = await device.AVTransportService.GetTransportInfo();

    console.log('Full position info:', positionInfo);
    console.log('Transport info:', transportInfo);

    res.json({
      title: positionInfo.TrackMetaData?.Title || 'Unknown',
      artist: positionInfo.TrackMetaData?.Artist || '',
      albumArt: positionInfo.TrackMetaData?.AlbumArtUri || '',
      transportState: transportInfo.CurrentTransportState || 'UNKNOWN',
      relTime: positionInfo.RelTime || '0:00:00',
      duration: positionInfo.TrackDuration || '0:00:00'
    });
  } catch (err) {
    console.error('Status failed:', err);
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(port, () => {
  console.log(`Sonos backend listening on port ${port}`);
});

app.post('/control', async (req, res) => {
  const { host, action } = req.body;

  console.log(`🔘 ${action.toUpperCase()} requested for ${host}`);

  const device = manager.Devices.find(d => d.Host === host);
  if (!device) return res.status(404).json({ error: 'Speaker not found' });

  try {
    const transportState = await device.AVTransportService.GetTransportInfo();
    console.log(`📻 Transport state for ${host}: ${transportState.CurrentTransportState}`);

    const positionInfo = await device.AVTransportService.GetPositionInfo();
    console.log('📀 Position info:', positionInfo);

    switch (action) {
      case 'play':
        console.log('▶️ Resuming playback...');
        await device.Play();
        break;
      case 'pause':
        console.log('⏸️ Pausing playback...');
        await device.AVTransportService.Pause();
        break;
      case 'next':
        console.log('⏭️ Skipping to next track...');
        await device.Next();
        break;
      case 'previous':
        console.log('⏮️ Going to previous track...');
        await device.Previous();
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Failed to ${action}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/volume', async (req, res) => {
  const { host, volume } = req.body;

  console.log(`🔊 Volume change requested: ${volume} for ${host}`);

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
    res.status(500).json({ error: err.message });
  }
});

app.get('/volume', async (req, res) => {
  const { host } = req.query;

  if (!host) return res.status(400).json({ error: 'Missing host param' });

  const device = manager.Devices.find(d => d.Host === host);
  if (!device) return res.status(404).json({ error: 'Speaker not found' });

  try {
    const response = await device.RenderingControlService.GetVolume({
      InstanceID: 0,
      Channel: 'Master'
    });

    const currentVolume = parseInt(response.CurrentVolume, 10);
    console.log(`📶 Current volume for ${host} is ${currentVolume}`);
    res.json({ volume: currentVolume });
  } catch (err) {
    console.error(`❌ Failed to get volume:`, err.message);
    res.status(500).json({ error: err.message });
  }
});
