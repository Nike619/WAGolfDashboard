# Open Tee Sheet

A GitHub Pages dashboard of open tee times and ground conditions for Washington golf courses: 34 public courses, 21 with live tee times, plus 54 private clubs. A GitHub Actions job refreshes the data every morning. You don't need a server, a computer left running, or any API keys.

## Set up (about 5 minutes)

1. **Create a repo.** On github.com, click **New repository** and name it something like `tee-sheet`. Make it **Public**: GitHub Pages on a free plan needs a public repo.
2. **Upload the files.** On the new repo page, click **uploading an existing file**. Drag in everything from this folder: `index.html`, `README.md`, and the `data` and `scripts` folders. Then click **Commit changes**.
3. **Add the workflow file.** macOS Finder hides folders whose names start with a dot, so the `.github` folder usually gets left out when you drag files in. Add it by hand:
   - Click **Add file → Create new file**.
   - Type the name `.github/workflows/update.yml`. The slashes create the folders.
   - Paste in the contents of `.github/workflows/update.yml` from this folder, then click **Commit changes**.
   - Or, in Finder, press **Cmd+Shift+.** to show hidden files and drag the `.github` folder in along with the rest.
4. **Turn on Pages.** Go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
5. **Run it once.** Go to **Actions → Update tee times → Run workflow**. After about 3–5 minutes the site is live at `https://<your-username>.github.io/tee-sheet/`.

After that, it updates itself every morning at about 6:50 AM Pacific (5:50 AM in winter). The **Run a check** button on the page opens the Actions page, where **Run workflow** starts a check right away.

## Adding, pausing or removing a course

Edit `data/courses.json` on GitHub. Each save kicks off a fresh check. A course looks like this:

```json
{
  "id": "kayak-point",
  "name": "Kayak Point Golf Course",
  "access": "public",
  "city": "Stanwood", "region": "North Sound",
  "lat": 48.14, "lon": -122.36,
  "phone": "360-652-9676", "website": "https://…",
  "platform": "teeitup",
  "params": { "alias": "kayak-point-golf-course", "facility": 1234 },
  "bookUrl": "https://kayak-point-golf-course.book.teeitup.com/?course=1234&date={date}&golfers={players}",
  "drainage": { "score": 3, "confidence": "low", "summary": "…", "sources": [] }
}
```

- **Pause a course:** set `"active": false`. **Remove it:** delete its block.
- **`access`:** `"public"` or `"private"`. Private clubs show ground conditions and a phone number, but no tee times.
- **`platform`:**
  - **`teeitup`** (the TeeItUp/GolfNow booking engine): params are `alias` and `facility`.
  - **`chronogolf`:** params are `club`, `course` and `aff` (the public rate ID).
  - **`foreup`:** params are `courseId`, `scheduleId` and `bookingClass`.
  - **`null`:** the course has no tee sheet the dashboard can read. It appears under **Book directly** with a link.
- **`drainage.score`:** 1 (soggy for days) to 5 (firm soon after heavy rain). Together with the last three days of rain, it decides the Dry / Damp / Soft / Soggy label.

Finding a course's booking IDs and researching how it drains takes some digging. You can ask Claude to do it and hand you the JSON block to paste in.

## How it works

- `scripts/fetch.mjs` (Node 20, no dependencies) reads public tee-time availability for the next 7 days from each course's booking site and daily rain from Open-Meteo. It writes the results to `data/results.json`, `data/weather.json` and `data/meta.json`. It only reads availability and never books anything.
- If a booking site stops responding, that course is marked **Check failed** and keeps its last good times. The other courses still update.
- `.github/workflows/update.yml` runs the script, commits the new data, and publishes the site.
- `index.html` is the whole page. It loads the JSON files from `data/`, and filters for players, time of day, price and region right in the browser.

## Ground-condition model

Each day's wetness index is:

`(rain that day + rain 1 day before + 0.6 × rain 2 days before + 0.35 × rain 3 days before) × retention`

Retention depends on the drainage score: 5 → 0.15, 4 → 0.35, 3 → 0.6, 2 → 0.85, 1 → 1.0.

The index maps to a label: below 0.08 is Dry, below 0.25 is Damp, below 0.5 is Soft, and anything higher is Soggy. It's an estimate, so call the pro shop after a big storm.
