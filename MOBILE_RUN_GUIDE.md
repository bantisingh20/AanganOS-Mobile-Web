# Mobile App Run & Build Guide (with Local API)

Complete guide to running and building the AanganOS mobile app (`@aanganos/app`) on an Android device or emulator with the local backend API (`http://localhost:5272`).

---

## Prerequisites

1. **Backend Running**:
   - Ensure `App.Api` is running on `http://localhost:5272` (via Visual Studio or `dotnet run`).
2. **Android Setup**:
   - Android Studio / Android SDK installed.
   - For physical device: Enable **Developer Options** and **USB Debugging** on your phone.
   - Connect phone via USB and verify with:
     ```bash
     adb devices
     ```
     *(Your phone should show as `device`, not `unauthorized`).*

---

## Method 1: USB / ADB Reverse (Recommended)

When connected via USB or running the Android emulator, forward port `5272` using `adb reverse`. This allows the mobile app to communicate with `http://localhost:5272` seamlessly without changing any IP addresses.

### 1. Reverse the Port
```bash
adb reverse tcp:5272 tcp:5272
```

### 2. Build Web Assets & Sync Capacitor
From `C:\Banti Work\React\AanganOS\AanganOS-Mobile-Web`:
```bash
# Build the mobile app web bundle
npm run build:app

# Sync assets to Android project
cd packages/app
npx cap sync android
```

### 3. Run on Device

#### Option A: Direct CLI Run
```bash
cd packages/app
npx cap run android
```
*(Select your target device from the prompt).*

#### Option B: Open in Android Studio
```bash
cd packages/app
npx cap open android
```
*(Click the green **Run (▶)** button in Android Studio).*

#### Option C: Live Reload (Hot Reload during dev)
```bash
cd packages/app
npx cap run android -l --external
```

---

## Method 2: Wi-Fi / LAN IP (Wireless Running)

If running wirelessly on your local Wi-Fi without ADB reverse:

### 1. Find PC IPv4 Address
In PowerShell / Command Prompt:
```bash
ipconfig
```
*(Look for your Wi-Fi IPv4 address, e.g. `192.168.1.2`).*

### 2. Set `.env` in `packages/app/`
Create or edit `packages/app/.env`:
```env
VITE_API_BASE_URL=http://<YOUR_PC_IP>:5272
```
*(Example: `VITE_API_BASE_URL=http://192.168.1.2:5272`)*

### 3. Build, Sync & Run
```bash
npm run build:app
cd packages/app
npx cap sync android
npx cap run android
```

---

## Quick One-Liner (Fast Rebuild & Deploy)

From `C:\Banti Work\React\AanganOS\AanganOS-Mobile-Web`:
```bash
adb reverse tcp:5272 tcp:5272; npm run build:app; cd packages/app; npx cap sync android; npx cap run android
```

---

## Troubleshooting

- **API calls fail with Network Error**:
  - Run `adb reverse tcp:5272 tcp:5272` again (needed every time the device is reconnected).
  - Check if Windows Firewall is blocking incoming connections on port `5272`.
- **Changes not reflecting**:
  - Re-run `npm run build:app` and `npx cap sync android` before running the app.
