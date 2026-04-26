# Project Juno — MVP Technical Plan

## 1. MVP Product Scope

Juno MVP has four core modules:

**Lookup / Safety Check**
- Sex offender registry lookup by name, optional age/DOB, state, zip
- Reverse image / public profile search from uploaded face image
- Results saved to a user's Roster

**Roster**
- Saved list of people the user has looked up
- Stores registry results, reverse image search results, user notes, uploaded chat screenshots, and AI summaries
- User can share a "tea package" with friends

**Dating Safety / Circle Map**
- User can add friends into a trusted circle
- Live location sharing map
- User can set status: `normal` or `on_date`
- When `on_date`, user selects someone from roster and starts a timer
- Friends can tap the user on the map and see who they are with

**Tea Package / AI Summaries**
- Share digestible summary of a roster person with selected friends
- Optional chat screenshot upload
- AI extracts/summarizes dating-app or iMessage conversation context

---

## 2. Recommended Tech Stack

### Mobile App

| Layer | Recommendation |
|---|---|
| Framework | Expo + React Native |
| Routing | Expo Router |
| Language | TypeScript |
| Styling | React Native StyleSheet + existing `/theme` tokens |
| Maps | react-native-maps |
| Location | expo-location |
| Background updates | Expo Task Manager + Location background mode (later) |
| Image upload | expo-image-picker |
| File upload | Supabase Storage |
| Push notifications | Expo Notifications |
| State management | Zustand or React Query + local state |
| Forms | React Hook Form + Zod |
| Auth | Supabase Auth |
| Backend client | Supabase JS |
| Payments (later) | RevenueCat or Stripe |

> The existing foundation (Expo SDK, Expo Router, React Native Maps, shared dock, Supabase client, themed UI shell) should be extended — not rebuilt.

### Backend

| Layer | Recommendation |
|---|---|
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| API layer | Supabase Edge Functions |
| Scheduled jobs | Supabase scheduled functions / cron |
| Realtime | Supabase Realtime |
| AI | OpenAI API (via Edge Functions only) |
| External lookup APIs | Called server-side only |
| Moderation / audit logs | Postgres tables |

> **Important:** Do not call sex offender APIs, image search tools, or OpenAI directly from the app. All sensitive API keys and lookup logic must live in Supabase Edge Functions.

---

## 3. High-Level Architecture

```
Expo Mobile App
   |
   | Supabase Auth
   | Supabase Realtime
   | HTTPS calls
   v
Supabase Edge Functions
   |
   |-- Sex Offender Registry API
   |-- Reverse Image / Public Web Search Provider
   |-- OCR / Vision API for chat screenshots
   |-- OpenAI summarization
   |
   v
Supabase Postgres
   |
   |-- users / profiles
   |-- friends / circles
   |-- roster_people
   |-- registry_checks
   |-- image_search_results
   |-- chat_uploads
   |-- tea_packages
   |-- date_sessions
   |-- live_locations
   |
   v
Supabase Storage
   |
   |-- profile photos
   |-- uploaded face images
   |-- chat screenshots
```

---

## 4. Core Data Model

### `profiles`
```sql
id              uuid primary key references auth.users(id),
first_name      text,
last_name       text,
phone           text,
avatar_url      text,
city            text,
created_at      timestamptz default now(),
updated_at      timestamptz default now()
```

### `friendships`
```sql
id              uuid primary key default gen_random_uuid(),
requester_id    uuid references profiles(id),
recipient_id    uuid references profiles(id),
status          text check (status in ('pending', 'accepted', 'blocked')),
created_at      timestamptz default now(),
updated_at      timestamptz default now()
```

### `roster_people`
```sql
id              uuid primary key default gen_random_uuid(),
owner_id        uuid references profiles(id),
display_name    text not null,
estimated_age   int,
dob             date,
state           text,
zip             text,
source          text check (source in ('manual', 'registry_lookup', 'image_search', 'chat_upload')),
notes           text,
ai_summary      text,
created_at      timestamptz default now(),
updated_at      timestamptz default now()
```

### `registry_checks`
```sql
id                  uuid primary key default gen_random_uuid(),
roster_person_id    uuid references roster_people(id),
owner_id            uuid references profiles(id),
query_name          text not null,
query_age           int,
query_state         text,
query_zip           text,
status              text check (status in ('clear', 'possible_match', 'match', 'error')),
raw_result          jsonb,
matched_name        text,
matched_dob         date,
matched_state       text,
matched_zip         text,
mugshot_url         text,
created_at          timestamptz default now()
```

### `image_searches`
```sql
id                  uuid primary key default gen_random_uuid(),
roster_person_id    uuid references roster_people(id),
owner_id            uuid references profiles(id),
uploaded_image_url  text,
status              text check (status in ('pending', 'completed', 'failed')),
raw_results         jsonb,
ai_summary          text,
created_at          timestamptz default now(),
updated_at          timestamptz default now()
```

### `image_search_results`
```sql
id                  uuid primary key default gen_random_uuid(),
image_search_id     uuid references image_searches(id),
title               text,
url                 text,
source_domain       text,
snippet             text,
image_url           text,
result_type         text,
confidence          numeric,
created_at          timestamptz default now()
```

### `chat_uploads`
```sql
id                  uuid primary key default gen_random_uuid(),
roster_person_id    uuid references roster_people(id),
owner_id            uuid references profiles(id),
screenshot_url      text,
ocr_text            text,
ai_summary          text,
opening_line        text,
red_flags           text[],
green_flags         text[],
created_at          timestamptz default now()
```

### `date_sessions`
```sql
id                  uuid primary key default gen_random_uuid(),
user_id             uuid references profiles(id),
roster_person_id    uuid references roster_people(id),
status              text check (status in ('active', 'ended', 'cancelled')),
started_at          timestamptz default now(),
ended_at            timestamptz,
timer_minutes       int,
last_known_lat      double precision,
last_known_lng      double precision,
notes               text
```

### `live_locations`
```sql
user_id                 uuid primary key references profiles(id),
lat                     double precision,
lng                     double precision,
accuracy                double precision,
status                  text check (status in ('normal', 'on_date')),
active_date_session_id  uuid references date_sessions(id),
updated_at              timestamptz default now()
```

### `tea_packages`
```sql
id                          uuid primary key default gen_random_uuid(),
sender_id                   uuid references profiles(id),
roster_person_id            uuid references roster_people(id),
summary                     text,
included_registry_check_id  uuid references registry_checks(id),
included_image_search_id    uuid references image_searches(id),
included_chat_upload_id     uuid references chat_uploads(id),
created_at                  timestamptz default now()
```

### `tea_package_recipients`
```sql
id              uuid primary key default gen_random_uuid(),
tea_package_id  uuid references tea_packages(id),
recipient_id    uuid references profiles(id),
viewed_at       timestamptz,
created_at      timestamptz default now()
```

---

## 5. App Navigation Map

```
Protect / Lookup
  ├── Safety Check Home
  │   ├── Sex Offender Lookup
  │   ├── Reverse Image Search
  │   └── Result Report
  │       ├── Save to Roster
  │       └── Share Tea Package

Roster
  ├── Roster List
  └── Person Profile
      ├── Registry Results
      ├── Image Search Results
      ├── Chat Screenshot Summaries
      ├── Notes
      └── Share Tea Package

Map
  ├── Live Circle Map
  ├── Friend Detail Sheet
  └── On Date Status Sheet
      ├── Select roster person
      ├── Start timer
      └── End date

Circles
  ├── Friend List
  ├── Add Friend
  ├── Pending Requests
  └── Location Sharing Settings

Tea / Inbox
  ├── Received Tea Packages
  ├── Tea Detail
  └── Chat / Comments (later)
```

> The current dock has Protect · Map · Circles · Chat. Rename or evolve **Chat → Tea / Inbox**, since the MVP's social sharing feature is more important than general chat.

---

## 6. Core User Flows

### Flow A — Sex Offender Registry Lookup
1. User opens **Protect** → selects "Registry Check"
2. Inputs name, optional age/state/zip
3. App calls `/lookup-registry` Edge Function
4. Backend queries registry API and normalizes results
5. App displays: clear / possible match / match, name, DOB, state, zip, mugshot if available
6. User taps "Save to Roster"
7. `roster_people` + `registry_checks` rows created

**Implementation notes:**
- Always show "possible match" language unless the API gives a highly certain identity match
- Add disclaimer: *"Results may include people with the same or similar name."*
- Avoid definitive identity claims unless legally safe

### Flow B — Reverse Image Search
1. User opens **Protect** → selects "Image Search"
2. Uploads a clear face image
3. App uploads image to Supabase Storage
4. App calls `/reverse-image-search` Edge Function
5. Backend sends image to search/crawler provider
6. Backend stores raw results; AI summarizes public findings
7. App displays: possible social profiles, LinkedIn/Instagram/public pages, confidence indicators, AI summary
8. User saves person to Roster

**Implementation notes:**
- Use careful language: *"possible matches," "public web results," "not identity verification"*
- Do not scrape behind logins
- Do not encourage stalking behavior
- Add report/delete controls

### Flow C — Add Person to Roster
1. Lookup result completed → user taps "Save to Roster"
2. If person already exists, suggest merge
3. User confirms → person profile created or updated
4. Lookup artifacts attached

**Roster person profile includes:** name, age/DOB, state/zip, registry status, public links, AI summary, chat screenshot summaries, user notes, tea package history.

### Flow D — Upload Chat Screenshot
1. User opens **Roster** → opens person profile → taps "Add Chat Screenshot"
2. Uploads screenshot
3. Backend OCR extracts text
4. AI summarizes: opening line, tone, red flags, green flags, date context
5. Summary saved to person profile

### Flow E — Share Tea Package
1. User opens person profile → taps "Share Tea Package"
2. Selects friends, chooses included info (registry result, public profile summary, chat summary, personal note)
3. Backend creates `tea_package`
4. Recipients get push notification
5. Recipients open Tea Inbox → view digestible profile summary

### Flow F — Start Date Mode
1. User opens **Map** → taps "Set Status" → toggles "On a Date"
2. Selects person from Roster, optional timer duration
3. Date session starts; `live_locations.status = on_date`
4. Friends see user marker change; friend taps marker
5. Friend sees: user is on a date, started-at time, timer, roster person selected, basic tea summary

---

## 7. API / Edge Function Contracts

### `lookup-registry`

**Input:**
```ts
{
  name: string;
  age?: number;
  dob?: string;
  state?: string;
  zip?: string;
}
```

**Output:**
```ts
{
  status: "clear" | "possible_match" | "match";
  matches: Array<{
    name: string;
    dob?: string;
    state?: string;
    zip?: string;
    mugshotUrl?: string;
    sourceId?: string;
  }>;
  disclaimer: string;
}
```

### `reverse-image-search`

**Input:**
```ts
{
  imageUrl: string;
  rosterPersonId?: string;
}
```

**Output:**
```ts
{
  status: "completed" | "failed";
  results: Array<{
    title: string;
    url: string;
    sourceDomain: string;
    snippet?: string;
    imageUrl?: string;
    confidence?: number;
  }>;
  aiSummary: string;
}
```

### `summarize-chat-screenshot`

**Input:**
```ts
{
  screenshotUrl: string;
  rosterPersonId: string;
}
```

**Output:**
```ts
{
  ocrText: string;
  summary: string;
  openingLine?: string;
  redFlags: string[];
  greenFlags: string[];
}
```

### `create-tea-package`

**Input:**
```ts
{
  rosterPersonId: string;
  recipientIds: string[];
  includeRegistry: boolean;
  includeImageSearch: boolean;
  includeChatSummary: boolean;
  note?: string;
}
```

**Output:**
```ts
{
  teaPackageId: string;
  recipientCount: number;
}
```

### `start-date-session`

**Input:**
```ts
{
  rosterPersonId: string;
  timerMinutes?: number;
  lat?: number;
  lng?: number;
}
```

**Output:**
```ts
{
  dateSessionId: string;
  status: "active";
  startedAt: string;
}
```

---

## 8. Phased Build Plan

### Phase 0 — Foundation Cleanup
**Goal:** Make the current app ready for real data.

- Add Supabase Auth
- Replace dev-only anonymous RLS with real user-scoped RLS
- Add `profiles`
- Add app-level session handling
- Add protected routes
- Add loading/error components
- Add typed Supabase client helpers
- Add `npm run typecheck`

**Deliverable:** User can sign up, log in, and land inside the app.

### Phase 1 — Roster Data Layer
**Goal:** Build the central object model before the lookup features.

- Create `roster_people` table
- Build Roster tab
- Build Person Profile screen
- Add manual "Add Person" flow
- Add notes field
- Add basic edit/delete/archive
- Add empty states

**Deliverable:** User can create and manage a private roster.

### Phase 2 — Sex Offender Registry Lookup
**Goal:** Ship the first real safety lookup.

- Build registry lookup form
- Create `lookup-registry` Edge Function
- Integrate external registry API
- Store results in `registry_checks`
- Add result report UI
- Add "Save to Roster"
- Add merge-with-existing-person logic

**Deliverable:** User can run a registry lookup and save results to roster.

### Phase 3 — Reverse Image Search
**Goal:** Add image-based public lookup.

**Status: deferred.** No integration has met the bar for **reliable, legal** “photo → real social profiles” at a quality safe for this product; generic reverse-image / people-search APIs are noisy, gated, or ToS‑limited. Revisit only when a provider or approach can support cautious “possible public matches” UX without pretending to be identity verification.

- Add image picker
- Upload image to Supabase Storage
- Create `reverse-image-search` Edge Function
- Integrate selected search/crawler provider
- Store results in `image_searches` and `image_search_results`
- Add AI summary
- Add result UI
- Save/attach to roster person

**Deliverable:** User can upload a face image, get public results, and save them.

### Phase 4 — Chat Screenshot AI Summary
**Goal:** Add gossip/context layer.

- Add screenshot upload on person profile
- Create `chat_uploads` table
- Add OCR provider
- Create `summarize-chat-screenshot` Edge Function
- AI extracts: opening line, vibe, red flags, green flags, useful context
- Display on person profile

**Deliverable:** User can upload a chat screenshot and get a useful summary.

### Phase 5 — Tea Package Sharing
**Goal:** Make Juno social.

- Create `tea_packages` and `tea_package_recipients`
- Build share package composer
- Select friends, choose included info
- Generate AI digest
- Build Tea Inbox
- Add push notification on receipt

**Deliverable:** User can share a digestible package about a roster person with friends.

### Phase 6 — Circles / Friend Graph
**Goal:** Add the trusted friend network.

- Create `friendships`
- Add friend search by phone/email/username
- Add invite flow, accept/decline
- Add friend list
- Add privacy settings

**Deliverable:** User can create a trusted circle.

### Phase 7 — Live Map + Date Mode
**Goal:** Deliver the signature dating safety feature.

- Add `live_locations`
- Add foreground location sharing
- Add map markers from real friend data
- Add `date_sessions`
- Add status toggle
- Add select-roster-person flow
- Add timer
- Add friend-facing date detail sheet
- Add end date flow

**Deliverable:** Friends can see when a user is on a date and who they are with.

### Phase 8 — Push Notifications + Safety Escalation
**Goal:** Make the safety layer feel alive.

- Push when friend starts date mode
- Push when timer expires
- Optional check-in prompt
- Optional "I'm safe" button
- Optional "alert circle" button

**Deliverable:** Circle gets proactive safety updates.

---

## 9. MVP Build Order

| Priority | Feature |
|---|---|
| 1 | Auth |
| 2 | Roster |
| 3 | Registry lookup |
| 4 | Reverse image search — **deferred** (see Phase 3 status) |
| 5 | Chat screenshot summary |
| 6 | Tea package sharing |
| 7 | Friend circles |
| 8 | Date mode map |

> **Reason:** Roster is the core data object. Registry lookup, image search, chat screenshots, tea packages, and date mode all depend on having a saved person profile.

---

## 10. Technical Risks

### Reverse Image Search
The hardest and most sensitive feature. Requires a provider that allows face/image search legally and reliably. Results must be framed as "possible public matches," not identity verification.

### Location Sharing
Real-time location drains battery and raises privacy complexity. MVP should start with foreground location updates while the app is open, then add background sharing later.

### Registry Matching
Name-based lookup can create false positives. Use cautious UX:
- *"Possible match found"*
- *"Verify details before making decisions"*
- *"Same/similar names may appear"*

### AI Summaries
AI should summarize, not accuse. Avoid language like:
- ❌ "He is dangerous"
- ❌ "He is lying"
- ❌ "He is a scammer"

Use instead:
- ✅ "Potential concern"
- ✅ "This may be worth asking about"
- ✅ "The available public info suggests…"

---

## 11. MVP Definition of Done

The MVP is complete when a user can:

- [ ] Create an account
- [ ] Add friends
- [ ] Look up a potential date by registry search
- [ ] ~~Look up a potential date by image search~~ — *Phase 3 deferred: no reliable provider for photo → socials today.*
- [ ] Save that person to roster
- [ ] Upload a chat screenshot and get an AI summary
- [ ] Share a tea package with a friend
- [ ] Start date mode with a roster person
- [ ] Have friends see their on-date status on the map
