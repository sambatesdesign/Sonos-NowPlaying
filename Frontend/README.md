# SonosNow Frontend

This is the **React Native** app for controlling Sonos speakers using a lightweight, touchscreen-optimized UI.

The app connects to the local Node.js backend (`sonosnow-backend`) to control speakers, adjust volume, and display now-playing information.

---

## 📱 Features

- View and control Sonos playback (play, pause, skip)
- Adjust speaker volume
- Display track info and artwork
- Select speakers from a list
- Triple-tap on artwork to reveal a settings panel
- Backend URL, restart app, and exit controls

---

## 🗂 Project Structure

\`\`\`
Frontend/
├── android/            # Android native build config
├── ios/                # iOS native build config
├── app.json            # Expo/React Native app config
├── App.tsx             # Main application UI
├── package.json        # Dependencies and scripts
└── ...
\`\`\`

---

## ⚙️ Setup & Run

1. Navigate to the frontend directory:
   \`\`\`bash
   cd Frontend
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Start Metro bundler:
   \`\`\`bash
   npx react-native start
   \`\`\`

4. In a separate terminal, build and run on Android:
   \`\`\`bash
   npx react-native run-android
   \`\`\`

---

## 📦 Building APK

To build a release APK for sideloading:

\`\`\`bash
cd android
./gradlew assembleRelease
\`\`\`

APK will be output to:
\`android/app/build/outputs/apk/release/app-release.apk\`

---

## 🧱 Built With

- [React Native](https://reactnative.dev/)
- [@react-native-community/slider](https://github.com/callstack/react-native-slider)
- [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage)
- [React Native Vector Icons](https://github.com/oblador/react-native-vector-icons)
- Node.js backend for speaker communication
