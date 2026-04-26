# Phase 8 Tomorrow Checklist

Use this short runbook to finish push setup when Expo account access is ready.

## 1) Expo account + EAS link

1. Create/login to Expo using company-owned email/account.
2. From repo root:
   - `npx eas-cli login`
   - `npx eas-cli whoami`
   - `npx eas-cli init` (if project is not linked yet)
   - `npx eas-cli project:info`

## 2) Create Expo access token

1. Open Expo dashboard account settings.
2. Create a personal access token.
3. Copy the token immediately.

## 3) Save token in Supabase

1. Supabase Dashboard -> Project -> Edge Functions -> Secrets.
2. Add:
   - Name: `EXPO_ACCESS_TOKEN`
   - Value: `<token from Expo>`

Note: Do not add custom `SUPABASE_*` secrets; those are system-managed in hosted projects.

## 4) Ensure timer cron is scheduled

1. Supabase SQL Editor -> run:
   - `supabase/cron-examples/invoke-check-date-timers.sql`
2. Confirm schedule exists and runs every 2 minutes.

## 5) Native test pass

1. Build/install native app (iOS + Android as needed).
2. Sign in and allow notifications.
3. Start date mode -> friend should get "date started" push.
4. Tap "I'm safe" -> friend should get check-in push.
5. Tap "Alert circle" -> friend should get alert push.
6. Let timer expire -> friend should get timer-ended push.

## 6) Troubleshooting quick checks

- Edge function logs:
  - `register-push-token`
  - `notify-date-mode-started`
  - `date-safety-signal`
  - `check-date-timers`
- Verify `push_devices` has token rows for receiving users.
- If Expo returns 401/403, re-check `EXPO_ACCESS_TOKEN`.
