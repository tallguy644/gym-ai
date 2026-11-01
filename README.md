# Gym AI

A web app that builds a weekly gym workout plan from your **current weight** and **goal weight**, using Claude as the coach.

You enter your weights, experience, how many days you can train, session length, equipment and any injuries. The app:

1. Works out whether you're losing, gaining or recomposing, a safe weekly pace and a rough timeline.
2. Asks Claude (`claude-opus-5-5` by default) for a plan in a fixed JSON shape (structured outputs), so every plan has days, exercises, sets, reps, rest, cardio, progression, nutrition and safety notes.
3. Shows the plan, keeps the last one in your browser, and lets you print or save it as a PDF.

The app has four tabs, styled as a dark mobile app:

- **Workout**: greeting, a daily readiness score from a quick check-in (sleep, energy, soreness, stress, each rated 1-5), an insight for today, and today's workout. Each exercise has **Swap Exercise**, **Adjust Sets** and **Watch how**. **Regenerate Plan** builds a fresh plan, and **Mark workout done** logs the session.
- **Coach**: chat with the AI coach about form, food and recovery. It knows your goal, today's workout and readiness. Without an API key it gives short built-in answers.
- **Analytics**: a goal progress ring with weeks to go, weight trend against your goal, a month calendar of workouts with your weekly streak, and readiness for the last 7 days.
- **Profile**: your name, weights and training details (and the AI coach status on Android).

With **Full gym** selected, plans and swaps use machines and cables first, and free weights only where there's no good machine option. The readiness score comes from the check-in, not from a wearable, and all history is stored only in your browser or phone.

If no API key is set, or the AI call fails, you still get a rule-based starter plan.

## Run it

Requires Node 20+.

```sh
npm install
cp .env.example .env      # then paste your ANTHROPIC_API_KEY into .env
npm start                 # http://localhost:3000
```

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Claude API key. Without it the app serves starter plans only. |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model used for plans. |
| `PORT` | `3000` | Port to listen on. |
| `PLAN_LIMIT_PER_HOUR` | `10` | AI plans each caller (IP address) gets per hour; after that, starter plans. `0` = no limit. |
| `COACH_LIMIT_PER_HOUR` | `60` | AI coach answers each caller gets per hour; after that, built-in answers. `0` = no limit. |

Refused requests are retried on another model automatically (server-side fallbacks, `fallbacks: "default"`).

## Android app (prototype)

`android/` is an installable Android app. It bundles the same page and plan logic.

- **AI plans and coach answers come from the Gym AI server** (see Deploy), which keeps the Claude API key. The app never asks for a key.
- The server address is built into the APK: the `GYM_AI_SERVER_URL` repository variable (Settings > Secrets and variables > Actions > Variables), or `https://gym-ai-tallguy644.onrender.com` if that isn't set. **AI coach** on the Profile tab shows whether the server is reachable and has its key, and lets you change the address.
- If the server can't be reached, the app builds a starter plan and gives built-in coach answers on the phone, offline.
- "Watch how" links open in YouTube.

**Install:** every build is published to the [`android-prototype` pre-release](../../releases/tag/android-prototype). Each build gets a test number (`gym-ai-test-N.apk`, also shown at the bottom of the Profile tab). On your phone, download the newest `gym-ai-test-N.apk`, open it, and allow installs from your browser if asked. New builds install over the old one.

**Build it yourself** (needs Node 20+, JDK 17 and the Android SDK):

```sh
npm ci
npm run build:android-web            # bundles the page into android/app/src/main/assets/www
cd android && ./gradlew assembleDebug  # APK in android/app/build/outputs/apk/debug/
```

## Tests

```sh
npm test
```

Tests use a fake Claude client, so they don't need a key or network.

## Files

| File | What it is |
| --- | --- |
| `domain.mjs` | Input checks, goal math, and the starter plan. |
| `ai.mjs` | Prompt, plan JSON schema, and the Claude call. |
| `coach.mjs` | AI coach chat (Claude) with built-in answers when there is no key. |
| `server.mjs` | Small Node HTTP server: `POST /api/plan`, `POST /api/coach`, `GET /api/health`, static files. |
| `plan-service.mjs` | Turns a form into a plan response; shared by the server and the Android app. |
| `android/` | Android app: a WebView around the bundled page (`android/web/` adds on-phone plan building). |
| `public/` | The page (plain HTML, CSS and JS; works on phones and can be added to the home screen). `readiness.js` scores check-ins, `swaps.js` picks exercise swaps, `progress.js` works out goal progress, streaks and the calendar. |

## Deploy

`render.yaml` deploys it as a free Render web service named `gym-ai-tallguy644`:

1. On [render.com](https://render.com), sign in with GitHub and choose **New > Blueprint**, then pick this repo.
2. When asked, paste your Claude API key as `ANTHROPIC_API_KEY` (get one at [platform.claude.com](https://platform.claude.com/)).
3. When it's live, open `https://<service>.onrender.com/api/health`. It should say `"ai":true`.
4. If Render gave the service a different address, set it as the `GYM_AI_SERVER_URL` repository variable and rebuild the APK (or paste it in the app's AI coach settings).

The server allows calls from the Android app (CORS for `https://appassets.androidplatform.net`) and limits AI requests per caller per hour so a shared key can't be run up. Setting a monthly spend limit in the Claude Console is a good extra guard. Free Render services sleep when idle, so the first request after a while can take up to a minute; the app pings the server when it opens to wake it.

Plans are general fitness guidance, not medical advice.
