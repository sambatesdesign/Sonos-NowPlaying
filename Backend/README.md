# SonosNow Backend

This is the backend server for the **SonosNow** project, a local API that communicates with Sonos speakers on your network using [`@svrooij/sonos`](https://github.com/svrooij/node-sonos-ts). It now runs either as a **standalone Electron app** or via traditional **Node.js CLI**.

---

## ✨ Features

- Auto-discovers Sonos speakers on your network
- Lists available players (`/players`)
- Provides now-playing info (`/status`)
- Controls playback (`/control`)
- Adjusts speaker volume (`/volume`)
- Clean Electron tray app with built-in log UI and system tray access

---

## 📁 Project Structure

```
Backend/
├── electron-main.js      # Main Electron entry point
├── ui.html               # Simple log viewer UI
├── main.js               # Legacy Node.js-only entry point
├── sonos-icon.png        # Tray icon (PNG)
├── sonos-icon.icns       # macOS app icon (ICNS)
├── package.json          # Scripts and build config
├── .gitignore
```

---

## 🚀 Getting Started (Electron App)

### 1. Install dependencies

```bash
npm install
```

### 2. Run the Electron app in development

```bash
npm start
```

This launches a macOS-style tray app with:

- Tray icon
- "Show Logs" window showing backend activity
- "Quit" to cleanly shut down both the backend and Electron

### 3. Build a standalone macOS `.dmg` app (optional)

```bash
npm run dist
```

The packaged `.dmg` will appear in the `dist/` folder and can be distributed or dragged into your Applications folder.

---

## ⚙️ Alternative: Run Backend with Node.js

If you prefer to run it directly (or use it in development environments), you can use the `main.js`:

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
node main.js
```

Server will start on `http://localhost:3000`.

---

## 🔌 API Endpoints

- `GET /players`  
  → Returns a list of available Sonos speakers.

- `GET /status?host=192.168.1.133`  
  → Returns track/transport info for a given speaker.

- `POST /control`  
  ```json
  {
    "host": "192.168.1.133",
    "action": "play" // or "pause", "next", "previous"
  }
  ```

- `GET /volume?host=192.168.1.133`  
  → Returns current speaker volume.

- `POST /volume`  
  ```json
  {
    "host": "192.168.1.133",
    "volume": 20
  }
  ```

---

## 📝 License

MIT
