# Juno — Live Technical Specs

This document is the **source of truth for technical implementation** of the current project state.

> **Live document rule:** update this README whenever product behavior, architecture, data model, flow logic, infrastructure, or developer workflows change.

---

## 1) Project Overview

**Juno** is a women’s safety **mobile app** (Expo + React Native). Product direction includes circle-based location sharing, pre-date check-ins, discreet background-style checks, and related flows — implemented incrementally.

**What exists in this repository today:**

- **Expo SDK 54** app with **Expo Router** (`expo-router/entry`).
- **Product plan:** see **`JUNO_MVP.md`** in-repo for phased build goals and data model. **Phase 0 + Phase 1 + Phase 2 + Phase 4** are implemented in this repo (Phase 4 was built before Phase 2; order in `JUNO_MVP.md` may differ).
- **Home route (`/`)** — “**Safety Check**” (requires sign-in): **Juno** wordmark, dashed **upload screenshot** card (optional; still stubbed — `console.log` only), a single form card with **first name**, **last name**, **city** (optional), collapsible **more** (state, ZIP, DOB), **Run safety check** gradient CTA — calls Supabase Edge Function **`lookup-registry`** (Offenders.io on the server), then opens **`/registry/result`** with the saved `registry_checks` id. **Sign out** and disclaimer copy. No “signed in as” line on this screen.
- **Map route (`/map`)** — **`react-native-maps`** roadmap centered on Seattle, **Google-style light map JSON** on Android (`PROVIDER_GOOGLE`); iOS uses Apple Maps. **No top header** (full-bleed map under status bar); **glass search bar** (placeholder: “Find family, friends, or places…”) + mic stub; **custom markers** (initials on discs + status pill + tail); **people bottom sheet** (rows sorted with **date status first**; initials + corner status icon). Pins / search / mic / rows log to `console.log` for now.
- **Report route (`/report`)** — **Legacy / demo** “background check” UI (initials avatar, verification copy, share-with-circle sheet). **Not** the primary path from **`/`** today; the live registry flow is **`/` → `/registry/result`**.
- **Auth route (`/auth`)** — email/password **sign in** and **sign up** (`signInWithPassword` / `signUp`); bouncy `ScrollView` + `KeyboardAvoidingView` so primary actions stay reachable when the keyboard is open.
- **Shared `AppDock`** — `components/AppDock.tsx`: **Protect · Roster · Map · Circles**; Protect ↔ `/`, Roster ↔ `/roster`, Map ↔ `/map` via `router.replace` (instant transition: root **`Stack`** uses **`animation: 'none'`**); Circles remains a stub.
- **Roster routes** (all protected): **`/roster`** list with empty states + archived filter, **`/roster/add`** manual add flow, and **`/roster/[id]`** person profile with notes, edit/delete/archive, **registry check** history + link to **`/registry/lookup`**, and **Phase 4** chat screenshot upload + summaries.
- **Registry routes** (protected): **`/registry/lookup`** (standalone lookup, optional `rosterPersonId` when opened from a person), **`/registry/result`** — Offenders.io-backed matches (photos sorted first; tap photo for full-screen), **Save to roster** / **merge into existing person**.
- **Global design tokens** under `/theme` (colors, typography, spacing, radii, layout, shadows, **`mapGoogleStyle.ts`** for map JSON, **`getDockOuterHeight()`** for layout math). **`theme/shadows.ts`** tints use **`colors`** (e.g. primary / primaryContainer) instead of hardcoded purple hex where applicable.
- **Font loading + splash** in `app/_layout.tsx` (Plus Jakarta Sans via `@expo-google-fonts/plus-jakarta-sans`).

**Not in this repo yet (typical next steps):**

- Reverse image lookup (Phase 3) and remaining MVP phases.
- More dock routes (Circles as real screens), push notifications, subscriptions.

**Current status:** **Phase 0 + Phase 1 + Phase 2 + Phase 4**. Supabase includes **`public.registry_checks`** (RLS select/update by owner), **`public.chat_uploads`**, private **`chat-screenshots`** storage; Edge Functions **`lookup-registry`** (Offenders.io registry search + DB row) and **`summarize-chat-screenshot`** (Anthropic OCR/summary). Home **Run safety check** persists a row and shows real matches on **`/registry/result`**.

### Phase 0 checklist (aligned to `JUNO_MVP.md` §8)

| Item | Status |
|------|--------|
| Supabase Auth (email/password) | Done (`app/auth.tsx`, `AuthProvider`) |
| Replace dev-only anon RLS with user-scoped RLS | Done (migration `phase0_auth_foundation`) |
| `profiles` table | Done; `id` = `auth.users.id`, + `updated_at` |
| App-level session handling | Done (`AuthProvider`, `onAuthStateChange`) |
| Protected routes | Done (`app/_layout.tsx` guard) |
| Loading / error components | Done (`AppLoading`, `AppErrorState`) |
| Typed Supabase client helpers | Done (`lib/supabase.ts`, `lib/database.types.ts`) |
| `npm run typecheck` | Done |

**Phase 0 deliverable:** user can sign up, sign in, and land on the in-app home (`/`).

### Phase 2 checklist (registry — aligned to `JUNO_MVP.md` §8)

| Item | Status |
|------|--------|
| `registry_checks` table + RLS | Done (migration `phase2_registry_checks`) |
| `lookup-registry` Edge Function | Done; Offenders.io `GET` + normalize `offenders[]` → app matches |
| Client `lookupRegistry()` | Done (`lib/api/registry.ts` → `functions.invoke`) |
| Home → result → save/merge roster | Done (`/`, `/registry/result`, `lib/registryChecks.ts`) |
| Roster profile: linked checks + “run again” | Done (`/roster/[id]`) |

**Edge secrets (Supabase Dashboard → Edge Functions → Secrets, not Expo):** `REGISTRY_LOOKUP_URL` (e.g. `https://api.offenders.io/sexoffender`), `REGISTRY_LOOKUP_API_KEY`. Optional stub behavior on dev if URL/key unset (function falls back to deterministic demo names).

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
| Images | **expo-image** + **expo-image-picker** |
| Maps | **react-native-maps** (roadmap; Android uses **Google** provider + JSON style when configured) |
| Gradients | **expo-linear-gradient** |
| Blur | **expo-blur** (map search/sheet chrome; report **Share** modal scrim) |
| Fonts | **expo-font** + **@expo-google-fonts/plus-jakarta-sans** (primary UI). **Fraunces** / **Inter** packages are present in `package.json` but are **not** loaded in root `_layout` today. |
| Babel | **babel-preset-expo** + **expo-router/babel** (both declared so Metro workers resolve them) |
| Backend (client) | **`@supabase/supabase-js`** + **`@react-native-async-storage/async-storage`** — typed `lib/supabase.ts` with RN auth session persistence for PostgREST/Auth over HTTPS. |

---

## 3) Repository Structure

```
juno/
├── app/
│   ├── _layout.tsx      # Root layout: fonts, splash, SafeAreaProvider, AuthProvider, route guard
│   ├── auth.tsx         # Route `/auth` — email/password auth (sign in + sign up)
│   ├── index.tsx        # Route `/` — Safety Check: form + Run safety check → registry
│   ├── map.tsx          # Route `/map` — family map UI (map + sheet + search)
│   ├── report.tsx       # Route `/report` — demo background-check UI (not wired from `/`)
│   ├── registry/
│   │   ├── _layout.tsx  # Registry stack
│   │   ├── lookup.tsx  # `/registry/lookup` — optional deep link from roster
│   │   └── result.tsx  # `/registry/result` — matches, photos, save/merge
│   └── roster/
│       ├── _layout.tsx  # Roster stack layout
│       ├── index.tsx    # Route `/roster` list + empty states + archived toggle
│       ├── add.tsx      # Route `/roster/add` manual add flow
│       └── [id].tsx     # Route `/roster/[id]` profile edit + archive/delete + chat uploads
├── components/
│   ├── AppDock.tsx      # Shared bottom navigation (Protect / Map / …)
│   ├── AppErrorState.tsx # App-wide error UI
│   └── AppLoading.tsx   # App-wide loading UI
├── lib/
│   ├── database.types.ts # Generated Supabase DB types
│   ├── supabase.ts      # Typed `getSupabase()` + profile upsert helper
│   ├── roster.ts        # Roster CRUD helpers
│   ├── api/
│   │   └── registry.ts  # `lookupRegistry()` → `lookup-registry` Edge Function
│   ├── registryChecks.ts # Registry check fetch + link to roster person
│   └── chatUploads.ts   # Chat upload list helper
├── providers/
│   └── AuthProvider.tsx # Session handling + auth state listener
├── supabase/
│   ├── migrations/      # Profiles, roster_people, registry_checks, chat_uploads (+ storage/RLS)
│   └── functions/
│       ├── lookup-registry/
│       │   └── index.ts # Edge Function: Offenders.io search + insert `registry_checks`
│       └── summarize-chat-screenshot/
│           └── index.ts # Edge Function: OCR + AI summary via Anthropic
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
2. **`app/_layout.tsx`** loads fonts, keeps native splash until fonts resolve (or error), then wraps the app in **`SafeAreaProvider`** + **`AuthProvider`**. A root route guard redirects signed-out users to `/auth`, redirects signed-in users away from `/auth`, and renders app-level loading/error states.
3. **`app/index.tsx`** is the **default route** `/` (home); **`app/roster/index.tsx`** is **`/roster`**; **`app/map.tsx`** is **`/map`**; **`app/report.tsx`** is **`/report`**; **`app/registry/*`** are **`/registry/...`**. All of these (and other non-`/auth` stack routes) are **reachable only with a valid session** unless the route guard is extended later.

### 4.2 State on the home screen

- **Local React state:** first name, last name, city (optional), optional state / ZIP / DOB, expand toggle, loading for CTA.
- **Auth** — `useAuth()` for `user` and `signOut`.
- **Run safety check** — `lookupRegistry({ name, city?, state?, zip?, dob? })` then `router.push({ pathname: '/registry/result', params: { id: registryCheckId } })`.
- **Supabase:** auth sessions persist in RN storage; auth state is watched with `onAuthStateChange`; signed-in users are upserted into `profiles` by `id`.
- **Upload card** — still stubbed (`console.log`); non-routing dock tabs log to the console for now.

### 4.3 Auth screen (`/auth`)

- **Sign in** / **Sign up** toggle; uses `getSupabase().auth.signInWithPassword` and `signUp`.
- If the project has **email confirmation** enabled, sign-up may require confirming email before a session exists (UI shows a message).
- **Keyboard:** `KeyboardAvoidingView` + bouncy `ScrollView` so CTAs are not covered by the software keyboard.

### 4.4 Map screen

- **Static region** and **hard-coded marker coordinates** (demo positions near Seattle).
- **No profile photos** — markers and sheet rows use **initials** on `primaryFixed` discs.
- **Android:** set `android.config.googleMaps.apiKey` in **app.json** (or `app.config.js`) for Google tiles; without a key, tiles may fail on device builds.

### 4.5 Report screen (`/report`)

- **Demo / legacy** screen: query params `firstName`, `city` if you navigate here manually; **stub** verification blocks and socials.
- **Share with Circle** — modal uses **`animationType: 'slide'`**, bottom sheet, **BlurView** + dim overlay; member selection is **local state**; confirm uses **`Share.share`** with a text summary (stub).

### 4.6 Registry flow (Phase 2)

- **Server-only vendor calls:** the app never holds Offenders credentials; **`lookup-registry`** uses `REGISTRY_LOOKUP_URL` + `REGISTRY_LOOKUP_API_KEY` and the user JWT.
- **Request shape:** combined **full name** plus optional **city**, **state** (2-letter expanded to full state name for Offenders), **zip**, **dob**; optional **`rosterPersonId`** when the check is tied to an existing roster person.
- **Response:** normalized `matches` (name, dob, state, zip, mugshot URL, person UUID); stored in **`registry_checks.raw_result`** and summary columns.
- **Result UI (`/registry/result`):** matches with photos **first**; circular photo or **placeholder avatar**; tap photo for full-screen preview; **Save to roster** creates/links `roster_people` with `source: 'registry_lookup'`.

### 4.7 Theming

- Visuals follow the **Aura / Material-style** token set in `theme/colors.ts` (e.g. `primary`, `surfaceBright`, `secondaryContainer`, dock indigo accents).
- **Shadows** are defined in `theme/shadows.ts` with iOS `shadow*` and Android `elevation` where applicable, referencing **`colors`** for tint.

### 4.8 Chat screenshot AI flow (Phase 4)

- User opens **`/roster/[id]`** and taps **Add Chat Screenshot**.
- App picks an image via `expo-image-picker`, uploads bytes to private bucket **`chat-screenshots`** at `{userId}/{rosterPersonId}/{timestamp}.{ext}`.
- App invokes edge function **`summarize-chat-screenshot`** with `{ rosterPersonId, screenshotPath }`.
- Function validates JWT and ownership, downloads screenshot, runs Anthropic vision OCR + cautious text summary, stores output in **`public.chat_uploads`**, then returns parsed fields to client.
- UI reloads and renders timestamp, summary, opening line, red flags, and green flags cards.

---

## 5) Routes

| Path | File | Purpose |
|------|------|---------|
| `/auth` | `app/auth.tsx` | Email/password auth (sign in + sign up); public when signed out |
| `/` | `app/index.tsx` | Safety Check home → registry lookup + navigate to result (protected) |
| `/roster` | `app/roster/index.tsx` | Roster list + empty states + archived toggle (protected) |
| `/roster/add` | `app/roster/add.tsx` | Manual Add Person flow (protected) |
| `/roster/[id]` | `app/roster/[id].tsx` | Person profile + registry checks + chat uploads + archive/delete (protected) |
| `/map` | `app/map.tsx` | Circle / family map (protected) |
| `/registry/lookup` | `app/registry/lookup.tsx` | Standalone registry form (e.g. from roster deep link) (protected) |
| `/registry/result` | `app/registry/result.tsx` | Registry matches + save/merge to roster (protected) |
| `/report` | `app/report.tsx` | Demo background-check UI + share sheet (protected; not used from `/`) |

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

If `npm install` fails on **peer dependency** resolution (common with `expo-router` / `react-dom` optional peers), use:

```bash
npm install --legacy-peer-deps
```

Then press `i` / `a` / scan QR for device. Use **`npx expo start -c`** if Metro cache causes stale bundles.

**Environment variables**

- Copy **`.env.example`** → **`.env`** in the repo root (`.env` is gitignored). **Expo does not load `.env.example`** — without a real **`.env`**, `getSupabase()` will throw at runtime.
- **Expo** loads **`EXPO_PUBLIC_*`** into the JS bundle — use these for the Supabase browser/RN client.
- **Where to get values:** Supabase Dashboard → **Project Settings** → **API**: **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`; **anon public** (legacy JWT) or **publishable** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY` (both work with `createClient` today).
- **Do not place provider secrets in Expo env:** keep them in **Supabase Edge Function secrets** only:
  - **`summarize-chat-screenshot`:** `ANTHROPIC_API_KEY`, optional `ANTHROPIC_VISION_MODEL`, `ANTHROPIC_TEXT_MODEL`.
  - **`lookup-registry`:** `REGISTRY_LOOKUP_URL` (e.g. `https://api.offenders.io/sexoffender`), `REGISTRY_LOOKUP_API_KEY` (Offenders.io key; sent as `key` query param per their API).
- **Postgres connection string** (`postgresql://…`, used by **Prisma**, scripts, or `psql`): Dashboard → **Project Settings** → **Database** → **Connection string** (URI). Prefer the **pooler** URI for serverless/tooling if you hit connection limits. **Do not** put `DATABASE_URL` in the mobile app — only in local tooling or a private server.
- **Prisma vs Supabase-only:** For this Expo app, the “backend” is normally **Supabase Postgres + RLS + PostgREST**, accessed only via **`@supabase/supabase-js`** from the client. Add **Prisma** only if you want a **separate Node** service or migration CLI talking to Postgres over `DATABASE_URL`; it is not installed in this repo by default (avoids duplicating schema between Prisma and Supabase migrations).

---

## 7) NPM Scripts

| Script | Command |
|--------|---------|
| `npm start` | `expo start` — dev server / QR |
| `npm run android` | `expo start --android` |
| `npm run ios` | `expo start --ios` |
| `npm run web` | `expo start --web` |
| `npm run typecheck` | `tsc --noEmit` |

Use **`npm run typecheck`** (or `npx tsc --noEmit`) before merging changes that touch TypeScript.

---

## 8) Native / Expo Config Notes

- **`app.json`**: `scheme: "juno"` for deep linking; `plugins` include **`expo-font`** and **`expo-router`**.
- **`newArchEnabled`**: `true` in `app.json` — align with Expo docs if you hit native module issues.
- **Babel:** `babel-preset-expo` and `@babel/core` are **dependencies** so Metro’s transform worker can always resolve the preset (avoids “Cannot find module 'babel-preset-expo'” when `devDependencies` are omitted).

---

## 9) Known Gaps and Planned Work

1. **Phase 3 (`JUNO_MVP.md`)** — Reverse image search + storage + Edge Function + roster save.
2. **Safety Check upload** — Wire dashed upload card to a real pipeline (OCR / chat flow or separate product path); still stubbed on **`/`**.
3. **Navigation** — Implement dock routes (Circles, Chat) as real screens or stacks; replace `console.log` stubs.
4. **Product flows** — Date mode, live circle map data, notifications, vault/history — stubs only today.
5. **Unused font packages** — Remove `@expo-google-fonts/fraunces` / `inter` or load them in `_layout` if design requires.
6. **Tests** — No unit/e2e suite yet; add Detox / Maestro / Jest as the app grows.
7. **CI** — No pipeline documented; add when publishing builds (EAS).

---

## 10) Product and Compliance Notes (placeholder)

- Copy on the Safety Check / registry result screens includes **non-notification** and **possible-match / similar-name** messaging — ensure marketing and legal review before production.
- **Offenders.io** (or any registry vendor) is a third-party data source; retention and accuracy follow their terms and the underlying registries — keep disclaimers aligned with counsel.

---

## 11) Definition of Done for Any Future Change

1. Update code.
2. **Update this README** (sections touched: overview, routes, stack, env, gaps).
3. Run **`npm run typecheck`** (or `npx tsc --noEmit`) and lint if you add ESLint.
4. Smoke-test on **iOS + Android** for UI or native changes.

---

## 12) Ownership and Documentation Policy

This is a **living specification**. If a change affects runtime behavior, data shape, user flow, infra, or security assumptions, update the relevant section **in the same PR / commit** when possible.

---

*Last aligned to repo: Phase 0 + Phase 1 + Phase 2 (registry: `registry_checks`, `lookup-registry`, `/registry/*`, `lib/api/registry.ts`) + Phase 4 (chat uploads + `summarize-chat-screenshot`), Safety Check home wired to real registry results, typed Supabase helpers.*
