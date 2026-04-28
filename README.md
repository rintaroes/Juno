# Juno — Live Technical Specs

This document is the **source of truth for technical implementation** of the current project state.

> **Live document rule:** update this README whenever product behavior, architecture, data model, flow logic, infrastructure, or developer workflows change.

---

## 1) Project Overview

**Juno** is a women’s safety **mobile app** (Expo + React Native). Product direction includes circle-based location sharing, pre-date check-ins, discreet background-style checks, and related flows — implemented incrementally.

**What exists in this repository today:**

- **Expo SDK 54** app with **Expo Router** (`expo-router/entry`).
- **Product plan:** see **`JUNO_MVP.md`** in-repo for phased build goals and data model. **Phase 0 + Phase 1 + Phase 2 + Phase 4 + Phase 6 + Phase 7 + Phase 8** are implemented in this repo (Phase 4 was built before Phase 2; order in `JUNO_MVP.md` may differ).
- **Onboarding route group (`/(onboarding)`)** — new **16-screen** first-launch flow (Hook → Problem → Personalized Solution → Immersion → Paywall), progress dots, character art, permissions, invite step, demo first check, and subscription paywall entry.
- **Home route (`/`)** — “**Safety Check**” (requires sign-in): **Juno** wordmark, dashed **upload screenshot** card (optional; still stubbed — `console.log` only), a single form card with **first name**, **last name**, **city** (optional), collapsible **more** (state, ZIP, DOB), **Run safety check** gradient CTA — calls Supabase Edge Function **`lookup-registry`** (Offenders.io on the server), then opens **`/registry/result`** with the saved `registry_checks` id. **Sign out** and disclaimer copy. No “signed in as” line on this screen.
- **Map route (`/map`)** — **Phase 7 + 8 live circle map + date mode + safety signals + optional always-on location:** Foreground **`expo-location`** watch while **`/map` is focused** → **`update_my_live_location`**; optional **“Always share location”** (saved on **`profiles.share_location_always`**) enables **`expo-task-manager`** background updates + OS permissions (Life360-style; rebuild required). **Supabase Realtime** + poll on **`live_locations`**; **`list_friends_map_snapshots`** for pins. **`react-native-maps`**, camera tuned for dock + Circle sheet. Glass **search**; **Date mode** + **I'm safe** / **Alert circle** pushes; **`notify-date-mode-started`** on session start. Tables / migrations: **`live_locations`**, **`date_sessions`**, **`push_devices`**, **`profiles.share_location_always`** (`phase7_*`, `phase8_*`, **`20260429120000_profiles_share_location_always.sql`**).
- **Report route (`/report`)** — **Legacy / demo** “background check” UI (initials avatar, verification copy, share-with-circle sheet). **Not** the primary path from **`/`** today; the live registry flow is **`/` → `/registry/result`**.
- **Auth route (`/auth`)** — email/password **sign in** and **sign up** (`signInWithPassword` / `signUp`); bouncy `ScrollView` + `KeyboardAvoidingView` so primary actions stay reachable when the keyboard is open. Onboarding auth step currently routes to this existing phone/email path (Apple/Google onboarding buttons removed for now).
- **Shared `AppDock`** — `components/AppDock.tsx`: **Protect · Roster · Map · Circles**; Protect ↔ `/`, Roster ↔ `/roster`, Map ↔ `/map`, Circles ↔ `/circles` via `router.replace` (instant transition: root **`Stack`** uses **`animation: 'none'`**).
- **Roster routes** (all protected): **`/roster`** list with empty states + archived filter, **`/roster/add`** manual add flow, and **`/roster/[id]`** person profile with notes, edit/delete/archive, **registry check** history + link to **`/registry/lookup`**, and **Phase 4** chat screenshot upload + summaries.
- **Registry routes** (protected): **`/registry/lookup`** (standalone lookup, optional `rosterPersonId` when opened from a person), **`/registry/result`** — Offenders.io-backed matches (photos sorted first; tap photo for full-screen), **Save to roster** / **merge into existing person**.
- **Global design tokens** under `/theme` (colors, typography, spacing, radii, layout, shadows, **`mapGoogleStyle.ts`** for map JSON, **`getDockOuterHeight()`** for layout math). **`theme/shadows.ts`** tints use **`colors`** (e.g. primary / primaryContainer) instead of hardcoded purple hex where applicable.
- **Font loading + splash** in `app/_layout.tsx` (Plus Jakarta Sans via `@expo-google-fonts/plus-jakarta-sans`).

**Not in this repo yet (typical next steps):**

- **Phase 3 (reverse image)** — **Intentionally deferred:** no provider meets a reliable / legal bar for photo → real social profiles for this UX.

**Current status:** **Phase 0 + Phase 1 + Phase 2 + Phase 4 + Phase 6 + Phase 7 + Phase 8** (+ Phase 5 tea tables/RPCs in migrations). Supabase includes **`public.registry_checks`**, **`public.chat_uploads`**, **`public.friendships`**, **`public.live_locations`**, **`public.date_sessions`**, **`public.push_devices`**, **`profiles`** (incl. **`share_location_always`**), private **`chat-screenshots`** storage; Edge Functions **`lookup-registry`**, **`summarize-chat-screenshot`**, **`register-push-token`**, **`notify-date-mode-started`**, **`date-safety-signal`**, **`check-date-timers`**. Home **Run safety check** persists a row and shows real matches on **`/registry/result`**.

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

### Phase 6 checklist (Circles — `JUNO_MVP.md` §8, abbreviated)

| Item | Status |
|------|--------|
| `friendships` + profile discoverability columns | Done (migrations `phase6_*`) |
| RPCs: search, request, respond, list relationships, remove | Done; **`/circles`** screen (`app/circles.tsx`) |

### Phase 7 checklist (live map + date mode — `JUNO_MVP.md` §8)

| Item | Status |
|------|--------|
| `live_locations` + `date_sessions` + RLS | Done (`20260427120000_phase7_date_mode.sql`) |
| Foreground location on Map tab | Done (`expo-location`, `lib/dateMode.ts` → `update_my_live_location`) |
| Friend markers + sheet from circle | Done (`list_friends_map_snapshots`, `app/map.tsx`) |
| Date mode: roster pick, timer, start/end | Done (`start_date_session` / `end_date_session` RPCs) |
| Friend / self detail + started time + snapshot text | Done (`companion_ai_summary` migration `20260427183000_phase7_companion_ai_snapshot.sql`) |
| Realtime on `live_locations` | Done (publication in migration; client subscribes on Map focus) |
| Optional always-on / background location | Done (`profiles.share_location_always`, `lib/backgroundLocationTask.ts`, `lib/liveLocationBackground.ts`, `expo-task-manager`; plugin enables iOS/Android background + Android foreground service — **requires native rebuild**) |

### Phase 8 checklist (push + safety escalation — `JUNO_MVP.md` §8)

| Item | Status |
|------|--------|
| `push_devices` table + RLS | Done (`20260428120000_phase8_push_safety.sql`) |
| `date_sessions` idempotency columns | Done (`started_push_sent_at`, `timer_push_sent_at`) |
| Push token registration from app | Done (`lib/pushNotifications.ts`, `AuthProvider`, `register-push-token`) |
| Notify circle on date start | Done (`notify-date-mode-started`, invoked from `app/map.tsx`) |
| Safety actions: I’m safe / alert circle | Done (`date-safety-signal`, buttons in `app/map.tsx`) |
| Timer-expired job endpoint | Done (`check-date-timers`, RPC `list_expired_date_timer_sessions`) |
| Scheduler example SQL | Done (`supabase/cron-examples/invoke-check-date-timers.sql`) |

**Apply migrations** to your hosted project with **`supabase db push`** (see `supabase/migrations/`). If migration history was created under different version ids elsewhere, use **`supabase migration repair`** / **`db pull`** per Supabase CLI messages — do not re-run destructive SQL blindly.

---

## 2) Tech Stack

| Layer | Choice |
|--------|--------|
| Framework | **Expo** ~54 |
| Router | **Expo Router** 6 (file-based `/app`) |
| Language | **TypeScript** ~5.9 |
| UI | **React Native** 0.81, **React** 19 |
| Styling | **StyleSheet** + shared **`/theme`** tokens (no NativeWind / no Tailwind in RN) |
| State | **Zustand** + AsyncStorage persist middleware (onboarding state) |
| Icons | **lucide-react-native** + **react-native-svg** |
| Images | **expo-image** + **expo-image-picker** |
| Maps | **react-native-maps** (Android: **Google** provider + JSON style; iOS: **MapKit**) |
| Location | **expo-location** (foreground while Map focused; optional background via **`expo-task-manager`** + always permission) |
| Background tasks | **expo-task-manager** (background location → same `update_my_live_location` RPC) |
| Push notifications | **expo-notifications** (permission + Expo token registration; **`EXPO_PUBLIC_EAS_PROJECT_ID`** in `.env` merged via **`app.config.ts`**) |
| Gradients | **expo-linear-gradient** |
| Blur | **expo-blur** (map search/sheet chrome; report **Share** modal scrim) |
| Fonts | **expo-font** + **@expo-google-fonts/plus-jakarta-sans** + **Fraunces** + **Inter** (loaded in `app/_layout.tsx`) |
| Babel | **babel-preset-expo** + **expo-router/babel** (both declared so Metro workers resolve them) |
| Backend (client) | **`@supabase/supabase-js`** + **`@react-native-async-storage/async-storage`** — typed `lib/supabase.ts` with **`persistSession: true`** / **`autoRefreshToken: true`** (needed for background location RPCs). |
| Contacts | **expo-contacts** (onboarding circle invite picker) |
| Subscriptions | **react-native-purchases** dependency installed; runtime wiring exists in onboarding paywall helper (native setup still required before production billing) |

---

## 3) Repository Structure

```
juno/
├── app/
│   ├── _layout.tsx      # Root layout: fonts, splash, SafeAreaProvider, AuthProvider, route guard
│   ├── auth.tsx         # Route `/auth` — email/password auth (sign in + sign up)
│   ├── index.tsx        # Route `/` — Safety Check: form + Run safety check → registry
│   ├── (onboarding)/    # 16-screen onboarding stack (first-launch gated)
│   │   ├── _layout.tsx  # Onboarding stack: no headers
│   │   ├── welcome.tsx ... paywall.tsx # Hook → Paywall flow screens
│   │   └── characters/  # Character-heavy screens (welcome/problem/first-check)
│   ├── map.tsx          # Route `/map` — circle map, date mode, push/safety, optional always-on location
│   ├── circles.tsx      # Route `/circles` — friends, requests, privacy (Phase 6)
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
│   ├── AnimatedCharacter.tsx # SVG character renderer (static; no animation)
│   ├── onboarding/      # Shared onboarding primitives (screen/header/body/button/dots/character)
│   ├── AppErrorState.tsx # App-wide error UI
│   └── AppLoading.tsx   # App-wide loading UI
├── assets/
│   └── character/       # Onboarding SVG variants (default/wave/heart/two/peeking/concerned/trio/settled)
├── lib/
│   ├── database.types.ts # Supabase DB types (tables + RPCs; keep in sync with migrations)
│   ├── supabase.ts      # Typed `getSupabase()` + profile upsert helper
│   ├── roster.ts        # Roster CRUD helpers
│   ├── dateMode.ts      # Phase 7/8: map RPCs + live location / date session + safety signal helpers
│   ├── backgroundLocationTask.ts # TaskManager task → `update_my_live_location` (imported from `app/_layout.tsx`)
│   ├── liveLocationBackground.ts # start/stop `Location.startLocationUpdatesAsync`
│   ├── pushNotifications.ts # Expo permission + token + register-push-token invoke
│   ├── onboardingAnalytics.ts # Event tracker helper (fallback insert/log strategy)
│   ├── onboardingInvites.ts # Invitation insert + Edge Function invoke helper
│   ├── subscriptions.ts # RevenueCat configure + purchase helper
│   ├── circles.ts       # Phase 6: circle RPCs + privacy helpers
│   ├── api/
│   │   └── registry.ts  # `lookupRegistry()` → `lookup-registry` Edge Function
│   ├── registryChecks.ts # Registry check fetch + link to roster person
│   └── chatUploads.ts   # Chat upload list helper
├── providers/
│   └── AuthProvider.tsx # Session handling + auth state listener
├── stores/
│   └── onboardingStore.ts # Persisted onboarding state (`juno_onboarding_completed` + flow data)
├── supabase/
│   ├── migrations/      # Through Phase 8 + `share_location_always` on profiles
│   └── functions/
│       ├── lookup-registry/
│       │   └── index.ts # Edge Function: Offenders.io search + insert `registry_checks`
│       ├── register-push-token/
│       │   └── index.ts # Edge Function: save Expo token in `push_devices`
│       ├── notify-date-mode-started/
│       │   └── index.ts # Edge Function: push accepted circle on date start
│       ├── date-safety-signal/
│       │   └── index.ts # Edge Function: push circle for `im_safe` / `alert_circle`
│       ├── check-date-timers/
│       │   └── index.ts # Edge Function: scheduled timer-expired pushes
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
├── app.json             # Expo config (scheme `juno`; plugins incl. expo-location with **background** flags for always-on sharing)
├── app.config.ts        # Merges `app.json` + optional Android Maps key + **`EXPO_PUBLIC_EAS_PROJECT_ID`** → `extra.eas.projectId`
├── PHASE8_TOMORROW.md   # Short Expo/push checklist (optional)
├── babel.config.js      # babel-preset-expo + expo-router/babel
├── package.json         # main: expo-router/entry
└── tsconfig.json
```

**Convention:** screens import **colors, type, spacing, etc. from `/theme`** — avoid hardcoding hex or ad-hoc font names in feature files when a token exists or should be added.

---

## 4) Runtime Architecture

### 4.1 Entry & navigation

1. **`package.json`** `"main": "expo-router/entry"` boots the router.
2. **`app/_layout.tsx`** imports **`lib/backgroundLocationTask`** once (registers the background location task), loads fonts, keeps native splash until fonts resolve (or error), then wraps the app in **`SafeAreaProvider`** + **`AuthProvider`**.
3. Root guard now checks AsyncStorage key **`juno_onboarding_completed`**. If missing, user is routed into **`/(onboarding)/welcome`** first.
4. After onboarding is completed, guard behavior applies: signed-out users redirect to `/auth`, signed-in users redirect away from `/auth`, with app-level loading/error states.
3. **`app/index.tsx`** is the **default route** `/` (home); **`app/roster/index.tsx`** is **`/roster`**; **`app/map.tsx`** is **`/map`**; **`app/report.tsx`** is **`/report`**; **`app/registry/*`** are **`/registry/...`**. All of these (and other non-`/auth` stack routes) are **reachable only with a valid session** unless the route guard is extended later.

### 4.2 State on the home screen

- **Local React state:** first name, last name, city (optional), optional state / ZIP / DOB, expand toggle, loading for CTA.
- **Auth** — `useAuth()` for `user` and `signOut`.
- **Run safety check** — `lookupRegistry({ name, city?, state?, zip?, dob? })` then `router.push({ pathname: '/registry/result', params: { id: registryCheckId } })`.
- **Supabase:** sessions **persist** in AsyncStorage (`persistSession: true`) so background location can call authenticated RPCs; auth state is watched with `onAuthStateChange`; signed-in users are upserted into `profiles` by `id`.
- **Upload card** — still stubbed (`console.log` on **`/`**).

### 4.3 Auth screen (`/auth`)

- **Sign in** / **Sign up** toggle; uses `getSupabase().auth.signInWithPassword` and `signUp`.
- If the project has **email confirmation** enabled, sign-up may require confirming email before a session exists (UI shows a message).
- **Keyboard:** `KeyboardAvoidingView` + bouncy `ScrollView` so CTAs are not covered by the software keyboard.

### 4.4 Map screen (Phase 7 + 8 + always-on option)

- **Data:** `listFriendsMapSnapshots` + optional **Realtime** on `public.live_locations` (fallback poll ~60s).
- **Self (foreground):** while **`/map` is focused**, `getCurrentPositionAsync` + `watchPositionAsync`; throttled **`update_my_live_location`** (~10s min interval).
- **Self (optional background):** if user enables **Always share location** and grants OS **always/background** permission, **`startLocationUpdatesAsync`** runs the task in **`backgroundLocationTask.ts`** (same RPC). Toggle stored as **`profiles.share_location_always`**.
- **Date mode:** **`start_date_session`** / **`end_date_session`** RPCs; Phase 8 **push** + **I'm safe** / **Alert circle** from Map UI.
- **UI:** Circle sheet switch for always-on (native only); map camera accounts for bottom dock + sheet; initial map region is street-zoom (not continent scale).
- **Android map tiles:** optional **`EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`** in `.env` → **`app.config.ts`**.
- **iOS / Android permissions:** **`expo-location`** config plugin includes **always** strings + background modes where enabled in **`app.json`** — **rebuild dev client / EAS** after changing plugins.

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

### 4.9 Onboarding flow architecture (new)

- **Entry condition:** first launch (or reset) when **`juno_onboarding_completed`** is absent/false.
- **State:** `stores/onboardingStore.ts` persisted with Zustand + AsyncStorage:
  - `currentStep`, `selectedReasons`, `invitedFriends`, `permissions`, `selectedTier`, `completed`.
- **Screens:** 16-step sequence from `/(onboarding)/welcome` to `/(onboarding)/paywall`.
- **UI primitives:** `components/onboarding/*` enforce consistent spacing, CTA treatment, progress dots, and character usage.
- **Characters:** onboarding uses local SVG assets in `assets/character`.
- **Current auth behavior inside onboarding:** phone/email path only (routes to existing `/auth`); OAuth onboarding buttons removed.
- **Paywall:** UI and purchase wiring exist (`lib/subscriptions.ts`) and can mark profile subscription status after successful purchase call.
- **Invites:** onboarding circle step can prepare invites and call the invite helper (`lib/onboardingInvites.ts`); depends on backend contracts (`invitations` table + invite Edge Function).

---

## 5) Routes

| Path | File | Purpose |
|------|------|---------|
| `/auth` | `app/auth.tsx` | Email/password auth (sign in + sign up); public when signed out |
| `/` | `app/index.tsx` | Safety Check home → registry lookup + navigate to result (protected) |
| `/roster` | `app/roster/index.tsx` | Roster list + empty states + archived toggle (protected) |
| `/roster/add` | `app/roster/add.tsx` | Manual Add Person flow (protected) |
| `/roster/[id]` | `app/roster/[id].tsx` | Person profile + registry checks + chat uploads + archive/delete (protected) |
| `/map` | `app/map.tsx` | Live circle map + date mode (protected) |
| `/circles` | `app/circles.tsx` | Friends, requests, privacy settings (protected) |
| `/registry/lookup` | `app/registry/lookup.tsx` | Standalone registry form (e.g. from roster deep link) (protected) |
| `/registry/result` | `app/registry/result.tsx` | Registry matches + save/merge to roster (protected) |
| `/report` | `app/report.tsx` | Demo background-check UI + share sheet (protected; not used from `/`) |
| `/(onboarding)/welcome` ... `/(onboarding)/paywall` | `app/(onboarding)/*.tsx` | First-launch onboarding + paywall sequence |

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
- **Optional (Android Map tiles):** `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` — see **`.env.example`**. Loaded via **`app.config.ts`** (not `app.json` alone).
- **Expo push project id:** `EXPO_PUBLIC_EAS_PROJECT_ID` — merged into **`extra.eas.projectId`** for **`expo-notifications`** (see **`.env.example`**).
- **RevenueCat keys (optional, onboarding paywall):**
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
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

- **`app.json`**: `scheme: "juno"` for deep linking; `plugins` include **`expo-font`**, **`expo-router`**, **`expo-location`** (when-in-use + **always** permission strings; **iOS background location** + **Android background / foreground service** flags for optional always-on sharing), and **`expo-notifications`**.
- **RevenueCat plugin note:** do **not** add `react-native-purchases` to Expo plugins in this repo right now; it currently breaks Expo config resolution in local dev. Keep runtime wiring in code until native config path is finalized.
- **`app.config.ts`**: spreads **`app.json`**, injects **`android.config.googleMaps.apiKey`** when `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` is set, and **`extra.eas.projectId`** when `EXPO_PUBLIC_EAS_PROJECT_ID` is set.
- **`newArchEnabled`**: `true` in `app.json` — align with Expo docs if you hit native module issues.
- **Babel:** `babel-preset-expo` and `@babel/core` are **dependencies** so Metro’s transform worker can always resolve the preset (avoids “Cannot find module 'babel-preset-expo'” when `devDependencies` are omitted).

---

## 9) Known Gaps and Planned Work

1. **Phase 3 (`JUNO_MVP.md`)** — Reverse image search **deferred** (documented in `JUNO_MVP.md` §8 Phase 3): no suitable provider for dependable social graph from a single photo.
2. **Safety Check upload** — Wire dashed upload card on **`/`** to a real pipeline (still stubbed).
3. **Onboarding polish** — Ongoing visual/layout tuning for exact final UX (spacing rhythm, card hierarchy, copy alignment) across all 16 screens.
4. **Tests** — No unit/e2e suite yet; add Detox / Maestro / Jest as the app grows.
5. **CI** — No pipeline documented; add when publishing builds (EAS).

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

*Last aligned to repo: Phase 0–2 + Phase 4 + Phase 6 + Phase 7 (`/map`, `date_sessions`, `live_locations`) + Phase 8 (push + safety Edge Functions + `lib/pushNotifications.ts`) + optional **always-on location** (`profiles.share_location_always`, `expo-task-manager`, `lib/backgroundLocationTask.ts`, auth **persistSession**) + full **16-screen onboarding** (`/(onboarding)` first-launch guard, Zustand persisted flow state, onboarding components, character SVG assets, invite/paywall helpers) + current onboarding UX iteration changes (larger character art, static characters, bottom-anchored CTAs, updated card/selection styling).*
