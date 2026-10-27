# Gym AI

A web app that builds a weekly gym workout plan from your **current weight** and **goal weight**, using Claude as the coach.

You enter your weights, experience, how many days you can train, session length, equipment and any injuries. The app:

1. Works out whether you're losing, gaining or recomposing, a safe weekly pace and a rough timeline.
2. Asks Claude (`claude-opus-5-5` by default) for a plan in a fixed JSON shape (structured outputs), so every plan has days, exercises, sets, reps, rest, cardio, progression, nutrition and safety notes.
3. Shows the plan, keeps the last one in your browser, and lets you print or save it as a PDF.

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

Refused requests are retried on another model automatically (server-side fallbacks, `fallbacks: "default"`).

## Android app (prototype)

`android/` is an installable Android app. It bundles the same page and plan logic, so it works without the server:

- With no API key it builds starter plans on the phone, offline.
- Paste a Claude API key under **AI coach settings** to get AI plans. The key is stored only on the phone, and the app calls the Claude API directly.
- "Watch how" links open in YouTube.

**Install:** every build is published to the [`android-prototype` pre-release](../../releases/tag/android-prototype). On your phone, download `gym-ai.apk`, open it, and allow installs from your browser if asked. New builds install over the old one.

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
| `server.mjs` | Small Node HTTP server: `POST /api/plan`, `GET /api/health`, static files. |
| `plan-service.mjs` | Turns a form into a plan response; shared by the server and the Android app. |
| `android/` | Android app: a WebView around the bundled page (`android/web/` adds on-phone plan building). |
| `public/` | The page (plain HTML, CSS and JS; works on phones and can be added to the home screen). |

## Deploy

`render.yaml` deploys it as a free Render web service. Set `ANTHROPIC_API_KEY` in the Render dashboard.

Plans are general fitness guidance, not medical advice.
