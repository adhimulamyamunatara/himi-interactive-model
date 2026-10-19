# Deploying HIMI: backend on Render, frontend on GitHub Pages

The backend (FastAPI) runs on Render. The frontend (a static React build) is published to GitHub Pages by a GitHub Actions workflow. Both are served over HTTPS, which the microphone needs.

Your Pages address will be `https://<github-username>.github.io/himi-interactive-model/`.

Do the steps in this order, because each step needs an address from the one before.

## 1. Backend on Render

Create a **Web Service** from this repository and set these fields. (The form defaults to Node, so change the language.)

| Field | Value |
| --- | --- |
| Language | **Python 3** |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/healthz` |
| Instance type | Free is enough to start |

Environment variables (set them in Render's dashboard, never in git):

| Key | Value |
| --- | --- |
| `GEMINI_API_KEY` | your own Gemini key |
| `GEMINI_MODEL` | the same model you use locally |
| `ALLOWED_ORIGINS` | `https://<github-username>.github.io` (the origin only: no path, no trailing slash needed) |
| `APP_ENV` | `production` |

If the build fails on the Python version, add `PYTHON_VERSION` with a version Render lists as supported.

When it is live, open `https://<your-service>.onrender.com/healthz`. It should show `{"status":"ok"}`. Copy the service URL for the next step.

## 2. Keep the free Render service awake

A free Render web service goes to sleep when nobody uses it, and the first request after that is slow. HIMI's live mode gives up after 25 seconds and uses basic mode, so a sleeping service shows up as "Basic mode".

A free Google Apps Script can ping the service every 10 minutes:

1. Go to <https://script.google.com> and create a project.
2. Paste this, with your own address:

```js
function keepAlive() {
  UrlFetchApp.fetch('https://<your-service>.onrender.com/healthz', { muteHttpExceptions: true });
}
```

3. Open **Triggers** (the clock icon), then **Add Trigger**: function `keepAlive`, event source **Time-driven**, **Minutes timer**, **Every 10 minutes**.
4. Run it once by hand and accept the permission prompt.

Things to know:
- `/healthz` only returns "ok". It never calls Gemini, so the ping costs no AI quota.
- Free Render instances have a monthly allowance of running hours shared across the free services in one workspace. A service that never sleeps uses nearly all of it, and your workspace already has other services. Check Render's current free-plan limits, or the services may be suspended late in the month.
- The ping cannot help during a redeploy or a crash. The first request after one can still be slow.

## 3. Frontend on GitHub Pages

1. In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. (Free Pages needs a public repository.)
2. Open **Settings → Secrets and variables → Actions → Variables** and add a repository variable:
   - Name: `VITE_API_BASE_URL`
   - Value: your Render URL, for example `https://himi-interactive-model.onrender.com`
3. Push to `main`, or run **Actions → Deploy frontend to GitHub Pages → Run workflow**.

The workflow checks that the variable is set, runs lint and the unit tests, builds the app for the `/himi-interactive-model/` path, adds a fallback page so refreshing on a deep link works, and publishes it.

## 4. Check the live site

- The Pages address opens and the logo shows.
- Refreshing on `/dashboard` still shows the dashboard.
- Sign in, open "Talk to HIMI live" and say a question. A real answer means the key and CORS are right.
- A "Basic mode" badge means the backend is unreachable, asleep, or slow. Open `/healthz` to see which.
- Test the microphone, and Telugu, on a phone.

## Notes

- **Sign-in is still the local demo** (no password, data in the browser). That is fine for a college project, but anyone who knows the Render address can call the API and use your Gemini quota. Set a budget alert and a quota cap on the key, and keep `.env` out of git (it is already ignored).
- If the key is ever exposed, create a new one and replace it in Render.
- The workflow reads the `VITE_API_BASE_URL` variable at build time, so after changing the Render address, run the workflow again.
