# AanganOS Mobile-Web

A React + Vite + TypeScript rebuild of AanganOS using **shadcn/ui** (Tailwind + Radix),
designed to run as a web app and as a native mobile app via **Capacitor**.

## Structure (single project)

One `package.json` / `vite.config.ts` / `tsconfig.json` / `node_modules` at the root. Everything
lives under `src/`:

```
AanganOS-Mobile-Web/
  components.json           shadcn config (CLI writes components to src/shared/components/ui)
  tailwind.config.ts        shadcn/tailwind theme (AanganOS green primary)
  src/
    index.css               tailwind + shadcn CSS variables
    main.tsx                app entry (mounts the MOBILE app today)
    mobile/                 the MAIN MOBILE APP (resident) — screens + mobile UI wrappers
      components/           shadcn-composed mobile widgets (PhoneFrame, fields, OTP, etc.)
      screens/              Welcome, Login, Forgot, Register, RegisterSociety, Home
      App.tsx               mobile router
    web/                    the ADMIN PORTAL (built later)
    shared/                 used by BOTH apps
      components/ui/        real shadcn components (button, input, card, select, input-otp, ...)
      lib/utils.ts          cn()
      api/                  ApiClient, AuthService, OnboardingClient, token store, errors, types
      i18n/                 en / hi / gu / mr
      services/             composed api/auth/onboarding singletons
      store/                AuthContext
```

Aliases: `@ -> src`, `@shared -> src/shared`, `@mobile -> src/mobile`, `@web -> src/web`.

## UI
All UI uses **shadcn/ui** components (added via `npx shadcn@latest add ...`) + Tailwind classes.
No hand-written CSS beyond the shadcn theme variables in `src/index.css`.

## Backend
Talks to the existing AanganOS backend (`ApiResult<T>` envelope). Base URL: `VITE_API_BASE_URL`
in `.env` (default `http://localhost:5272`).

## Run in Browser
```bash
npm install
npm run dev:app       # serves mobile app in browser
npm run dev:admin     # serves admin portal
```

## Run on Mobile Device / Emulator (Android)
See **[MOBILE_RUN_GUIDE.md](./MOBILE_RUN_GUIDE.md)** for complete instructions on building and running on an Android device with the local backend API.

Quick run with device on USB:
```bash
adb reverse tcp:5272 tcp:5272
npm run build:app
cd packages/app
npx cap sync android
npx cap run android
```

## Mobile screens done
- Welcome / splash
- Login
- Forgot password (request OTP -> verify -> reset -> done)
- Register user (community -> mobile -> OTP -> selfie -> preview -> personal -> ID -> done)
- Register society

## Next
- Admin portal under `src/web` (login / forgot / register-society for PowerUser + Org/Community admin)
