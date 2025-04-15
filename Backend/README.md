# SonosNow Backend

This is the Node.js backend for the SonosNow project. It provides a lightweight local API to communicate with Sonos speakers using the [`@svrooij/sonos`](https://github.com/svrooij/node-sonos-ts) library.

## Features

- Auto-discovers Sonos speakers on your local network
- Lists available players (`/players`)
- Provides now-playing info for a speaker (`/status?host=...`)
- Allows playback control (play, pause, skip) (`/control`)
- Supports volume adjustments (`/volume`)

## Project Structure

```
Backend/
├── main.js             # Main entry point
├── package.json        # Node.js dependencies and scripts
├── .gitignore          # Ignored files for Git
```

## Requirements

- Node.js (v18 or higher recommended)
- Speakers must be on the same local network

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the server:

```bash
node main.js
```

3. The backend will start on port **3000** by default. You can access it via:

```
http://<your-local-ip>:3000/players
```

## Example Endpoints

- `GET /players` – Lists Sonos speakers
- `GET /status?host=192.168.1.42` – Gets current track info
- `POST /control` – Send `{ host, action }` to play/pause/skip
- `POST /volume` – Send `{ host, volume }` to adjust volume

---

## License

MIT
