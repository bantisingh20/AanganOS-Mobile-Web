# @aanganos/app

AanganOS Mobile App (Capacitor + React + Vite).

For complete instructions on building and running the mobile app with local API on Android devices or emulators, refer to:
[MOBILE_RUN_GUIDE.md](../../MOBILE_RUN_GUIDE.md)

### Quick Run
```bash
# 1. Forward backend port (if device connected via USB)
adb reverse tcp:5272 tcp:5272

# 2. Build web bundle & sync Capacitor
npm run build
npx cap sync android

# 3. Run on connected Android device
npx cap run android
```
