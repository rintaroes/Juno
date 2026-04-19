# Juno — Live Technical Specs

This document is the **source of truth for technical implementation** of the current project state.

> **Live document rule:** update this README whenever product behavior, architecture, data model, flow logic, infrastructure, or developer workflows change.

---

## 1) Project Overview

**Juno** is a women’s safety **mobile app** (Expo + React Native). Product direction includes circle-based location sharing, pre-date check-ins, discreet background-style checks, and related flows — implemented incrementally.

**What exists in this repository today:**

- **Expo SDK 54** app with **Expo Router** (`expo-router/entry`).
- **Home route (`/`)** — “**Safety Check**” screen: centered **Juno** wordmark, Material-inspired UI (Plus Jakarta Sans, purple / M3-style tokens), dashed **upload screenshot** card (tap → `console.log` only), **first name** + **city** text fields, **Verify Profile** gradient CTA — navigates to **`/report`** with `firstName` / `city` query params (defaults applied when empty). Disclaimer copy.
- **Map route (`/map`)** — **`react-native-maps`** roadmap centered on Seattle, **Google-style light map JSON** on Android (`PROVIDER_GOOGLE`); iOS uses Apple Maps. **No top header** (full-bleed map under status bar); **glass search bar** (placeholder: “Find family, friends, or places…”) + mic stub; **custom markers** (initials on discs + status pill + tail); **people bottom sheet** (rows sorted with **date status first**; initials + corner status icon). Pins / search / mic / rows log to `console.log` for now.
- **Report route (`/report`)** — **Background check** result UI after verify: centered Juno, back to Protect, summary card with **initials avatar** (no photos), verification rows (identity, **sex offender registry** copy, collapsible **social links** stub), disclaimer, large **Share report with Circle** CTA. **Share** opens a **bottom sheet** with dark **blur + dim scrim**, **“Share with Circle”** header, **N Selected** pill, horizontal **circle member** strip (initials-only avatars, gradient ring when selected, **Add** stub), **Cancel** / **Share** (native share sheet with chosen names — stub).
- **Shared `AppDock`** — `components/AppDock.tsx`: **Protect · Map · Circles · Chat**; **Protect** ↔ `/`, **Map** ↔ `/map` via `router.replace` (instant transition: root **`Stack`** uses **`animation: 'none'`**); Circles / Chat stub `console.log`.
- **Global design tokens** under `/theme` (colors, typography, spacing, radii, layout, shadows, **`mapGoogleStyle.ts`** for map JSON, **`getDockOuterHeight()`** for layout math). **`theme/shadows.ts`** tints use **`colors`** (e.g. primary / primaryContainer) instead of hardcoded purple hex where applicable.
- **Font loading + splash** in `app/_layout.tsx` (Plus Jakarta Sans via `@expo-google-fonts/plus-jakarta-sans`).

**Not in this repo yet (typical next steps):**

- Supabase (or other) auth, database, and server APIs.
- Real image upload / reverse image search / background check integrations.
- More dock routes (Circles, Chat as real screens), push notifications, subscriptions.

**Current status:** UI / navigation shell / design system foundation — **no backend**, **no production data**.

---

## 2) Tech Stack

| Layer | Choice |
|--------|--------|
| Framework | **Expo** ~54 |
| Router | **Expo Router** 6 (file-based `/app`) |
| Language | **TypeScript** ~5.9 |
| UI | **React Native** 0.81, **React** 19 |
| Styling | **StyleSheet** + shared **`/theme`** tokens (no NativeWind / no Tailwind in RN) |
| Icons | **lucide-react-native** + **react-native-svg** |
| Images | **expo-image** (available; circle/report UIs use initials where noted) |
| Maps | **react-native-maps** (roadmap; Android uses **Google** provider + JSON style when configured) |
| Gradients | **expo-linear-gradient** |
| Blur | **expo-blur** (map search/sheet chrome; report **Share** modal scrim) |
| Fonts | **expo-font** + **@expo-google-fonts/plus-jakarta-sans** (primary UI). **Fraunces** / **Inter** packages are present in `package.json` but are **not** loaded in root `_layout` today. |
| Babel | **babel-preset-expo** + **expo-router/babel** (both declared so Metro workers resolve them) |

---

## 3) Repository Structure

```
juno/
├── app/
│   ├── _layout.tsx      # Root layout: fonts, splash, SafeAreaProvider, Stack (no header, animation: none)
│   ├── index.tsx        # Route `/` — Safety Check home UI
│   ├── map.tsx          # Route `/map` — family map UI (map + sheet + search)
│   └── report.tsx       # Route `/report` — background check result + share sheet
├── components/
│   └── AppDock.tsx      # Shared bottom navigation (Protect / Map / …)
├── theme/
│   ├── index.ts         # Re-exports all tokens
│   ├── colors.ts        # M3-style / Aura mock palette (primary, surfaces, etc.)
│   ├── typography.ts    # Plus Jakarta font family keys + type scale + lineHeight helper
│   ├── spacing.ts       # xs–xl spacing scale
│   ├── layout.ts        # containerMargin, dock padding, `getDockOuterHeight`, etc.
│   ├── radii.ts         # Corner radii (including sheet / dock lip)
│   ├── mapGoogleStyle.ts # Google Maps `customMapStyle` JSON (Android)
│   └── shadows.ts       # ambient card / CTA / dock / pin glow (imports `colors`)
├── app.json             # Expo config (scheme `juno`, plugins: expo-font, expo-router)
├── babel.config.js      # babel-preset-expo + expo-router/babel
├── package.json         # main: expo-router/entry
└── tsconfig.json
```

**Convention:** screens import **colors, type, spacing, etc. from `/theme`** — avoid hardcoding hex or ad-hoc font names in feature files when a token exists or should be added.

---

## 4) Runtime Architecture

### 4.1 Entry & navigation

1. **`package.json`** `"main": "expo-router/entry"` boots the router.
2. **`app/_layout.tsx`** loads fonts, keeps native splash until fonts resolve (or error), then wraps the app in **`SafeAreaProvider`** and a **headerless `Stack`** with **`animation: 'none'`** so dock switches between `/` and `/map` do not use a horizontal slide.
3. **`app/index.tsx`** is the **default route** `/` (home); **`app/map.tsx`** is **`/map`**; **`app/report.tsx`** is **`/report`**.

### 4.2 State on the home screen

- **Local React state** only: `firstName`, `city`, focus flags for inputs.
- **Verify Profile** — `router.push({ pathname: '/report', params: { firstName, city } })` (empty name falls back to demo full name in the report screen).
- **No persistence**, **no API** — upload and non-routing dock tabs log to the console for now.

### 4.3 Map screen

- **Static region** and **hard-coded marker coordinates** (demo positions near Seattle).
- **No profile photos** — markers and sheet rows use **initials** on `primaryFixed` discs.
- **Android:** set `android.config.googleMaps.apiKey` in **app.json** (or `app.config.js`) for Google tiles; without a key, tiles may fail on device builds.

### 4.4 Report screen (`/report`)

- **Query params:** `firstName`, `city` (from Safety Check); used for headings and copy only — **stub data** for verification blocks and socials.
- **Share with Circle** — modal uses **`animationType: 'slide'`**, bottom sheet, **BlurView** + dim overlay; member selection is **local state**; confirm uses **`Share.share`** with a text summary (stub).

### 4.5 Theming

- Visuals follow the **Aura / Material-style** token set in `theme/colors.ts` (e.g. `primary`, `surfaceBright`, `secondaryContainer`, dock indigo accents).
- **Shadows** are defined in `theme/shadows.ts` with iOS `shadow*` and Android `elevation` where applicable, referencing **`colors`** for tint.

---

## 5) Routes

| Path | File | Purpose |
|------|------|---------|
| `/` | `app/index.tsx` | Safety Check home (upload + fields + verify → report) |
| `/map` | `app/map.tsx` | Circle / family map (demo map + sheet + search) |
| `/report` | `app/report.tsx` | Background check result + share-with-circle sheet |

Add new routes as `app/<segment>.tsx` or `app/<folder>/index.tsx` per [Expo Router conventions](https://docs.expo.dev/router/introduction/).

---

## 6) Environment & Local Setup

**Prerequisites**

- Node.js **20+** (recommended for Expo tooling)
- **iOS:** Xcode + Simulator (macOS) or physical device + Expo Go / dev client  
- **Android:** Android Studio / emulator or device  

**Install & run**

```bash
npm install
npx expo start
```

Then press `i` / `a` / scan QR for device. Use **`npx expo start -c`** if Metro cache causes stale bundles.

**Environment variables**

- None are **required** for the current UI-only build.
- When Supabase or other services are added, document keys here and in `.env.example` (do not commit secrets).

---

## 7) NPM Scripts

| Script | Command |
|--------|---------|
| `npm start` | `expo start` — dev server / QR |
| `npm run android` | `expo start --android` |
| `npm run ios` | `expo start --ios` |
| `npm run web` | `expo start --web` |

Optional locally:

```bash
npx tsc --noEmit
```

(Add `npm run typecheck` in `package.json` if you want this as a formal script.)

---

## 8) Native / Expo Config Notes

- **`app.json`**: `scheme: "juno"` for deep linking; `plugins` include **`expo-font`** and **`expo-router`**.
- **`newArchEnabled`**: `true` in `app.json` — align with Expo docs if you hit native module issues.
- **Babel:** `babel-preset-expo` and `@babel/core` are **dependencies** so Metro’s transform worker can always resolve the preset (avoids “Cannot find module 'babel-preset-expo'” when `devDependencies` are omitted).

---

## 9) Known Gaps and Planned Work

1. **Backend & auth** — Supabase (or other) client, session, RLS-backed tables, etc.
2. **Safety Check** — Wire upload to **expo-image-picker** (or document picker), then API; real verify → report pipeline.
3. **Navigation** — Implement dock routes (Circles, Chat) as real screens or stacks; replace `console.log` stubs.
4. **Product flows** — Date mode, live circle map data, notifications, vault/history — stubs only today.
5. **Unused font packages** — Remove `@expo-google-fonts/fraunces` / `inter` or load them in `_layout` if design requires.
6. **Tests** — No unit/e2e suite yet; add Detox / Maestro / Jest as the app grows.
7. **CI** — No pipeline documented; add when publishing builds (EAS).

---

## 10) Product and Compliance Notes (placeholder)

- Copy on the Safety Check screen includes **anonymous search** messaging — ensure marketing and legal review before production.
- Any future **background check** or **people search** feature must match actual data sources, retention, and jurisdiction — update this README and in-app disclaimers when behavior is real.

---

## 11) Definition of Done for Any Future Change

1. Update code.
2. **Update this README** (sections touched: overview, routes, stack, env, gaps).
3. Run **`npx tsc --noEmit`** (and lint if you add ESLint).
4. Smoke-test on **iOS + Android** for UI or native changes.

---

## 12) Ownership and Documentation Policy

This is a **living specification**. If a change affects runtime behavior, data shape, user flow, infra, or security assumptions, update the relevant section **in the same PR / commit** when possible.

---

*Last aligned to repo: Safety Check home, `/map`, `/report`, shared dock, and Aura theme shell.*
