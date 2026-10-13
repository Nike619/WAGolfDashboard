# Open Tee Sheet: notes for Claude

A static GitHub Pages dashboard of open tee times and ground conditions for Washington golf courses. Live at https://nike619.github.io/WAGolfDashboard/. Owner: Alex (GitHub `Nike619`).

The site is read-only. Nothing in this repo books, holds or pays for a tee time, and it must stay that way.

## How it fits together

```
.github/workflows/update.yml   daily schedule + manual "Run workflow"
        │ runs
scripts/fetch.mjs              Node 20, no dependencies
        │ writes
data/results.json              tee times per course and date (compact strings)
data/weather.json              rain per course: 3 days back + 7 forecast (Open-Meteo)
data/meta.json                 last run status, shown in the page header
        │ read by
index.html                     the whole site: HTML, CSS and JS in one file
```

- `data/courses.json` is the only hand-edited data file: one JSON object per line, 88 courses. Every run reads it.
- The workflow runs at 13:50 and 15:05 UTC (6:50 and 8:05 AM Pacific in summer), on `workflow_dispatch`, and on pushes to `main` that touch `data/courses.json`, `index.html`, `scripts/**` or the workflow. It commits the data files, then deploys the repo root to Pages.
- Results format: `days[YYYY-MM-DD] = "HHMM,price,spots;HHMM,price,spots"`. Price is per player in whole dollars; spots is open spots. Either can be empty.
- A course that fails keeps its previous `days` with `ok: false` and an `error`. The page shows "Check failed".

## Commands

- `node tests/fetch.test.mjs`: offline test with mocked responses. Run it after any change to `scripts/fetch.mjs`.
- `node scripts/fetch.mjs`: real run against the live sites. It overwrites `data/results.json`, `data/weather.json` and `data/meta.json`, so don't commit those from a local run unless you mean to. It takes 10+ minutes because of rate-limit pacing.
- Preview the page with `python3 -m http.server` in the repo root, then open http://localhost:8000. It fetches `data/*.json` with relative URLs, so opening the file directly with `file://` won't load data.

## Course records (`data/courses.json`)

Required: `id` (kebab-case, unique), `name`, `access` (`"public"` or `"private"`), `city`, `region`, `lat`, `lon`, `drainage`, `status: "ready"`.
Optional: `active` (false pauses a course), `phone`, `website`, `bookUrl`, `rank`, `rankSources`, `note` (shown under the name), `platform`, `params`, `platformLabel`.

- `region` is one of: Seattle/Eastside, South Sound, North Sound, Kitsap/Olympic, Southwest WA, Central WA, Eastern WA.
- **Any Washington course with "Country Club" in its name is `private`.** This is Alex's rule; apply it even if the club sells public times. Mention that in `note`.
- Private courses never get `platform`; they appear in the private directory with ground conditions and phone number.
- `rank` is the course's position in a blend of Golf Digest, Golfweek, GolfPass and GOLF.com Washington lists (public and private ranked separately). Leave it out for courses that aren't ranked.
- `bookUrl` may contain `{date}` (YYYY-MM-DD) and `{players}`; the page fills them in.

### Booking platforms (`platform` + `params`)

Only these three can be read. Anything else gets `platform: null` and appears under "Book directly" with its `bookUrl`.

| platform | params | how to find them |
|---|---|---|
| `teeitup` (TeeItUp / GolfNow engine) | `alias`, `facility` | Try `GET https://phx-api-be-east-1b.kenna.io/facilities` with header `x-be-alias: <alias>`, guessing aliases from the name in kebab-case (`<name>-golf-course`, `<name>-golf-club`, `<name>`). A 200 response `[{id,name}]` gives `facility`. Many GolfNow-listed courses work this way even if their own site uses another system, but some return 0 times every day (Chambers Bay, Loomis Trail, Cedarcrest, Palouse Ridge, Tumwater Valley, LakeLand Village, Cedars at Dungeness, Wine Valley did). Check that at least one of the next 7 days has times before using it. bookUrl: `https://<alias>.book.teeitup.com/?course=<facility>&date={date}&golfers={players}` |
| `chronogolf` (Lightspeed) | `club`, `course`, `aff` | `GET https://www.chronogolf.com/marketplace/clubs/<club>/courses` gives course ids; `GET .../marketplace/organizations/<club>/affiliation_types` gives `aff`: use the public rate (`default_role: "public"`, named Public / Daily Fee). Club id is in the club's widget URL `/club/<club>/widget`. Prices use `green_fees[0].subtotal`, which includes a required cart where the course charges one. |
| `foreup` | `courseId`, `scheduleId`, `bookingClass` | Fetch `https://foreupsoftware.com/index.php/booking/<courseId>` and parse `SCHEDULES = [...]` from the HTML: use the 18-hole schedule's `teesheet_id`, and the first `booking_classes` entry with `online_booking_protected: "0"`. If the times API answers 401 "logged out", the course needs a login: set `platform: null` and note "Online times need a free account login" (Wine Valley, Oakbrook). |

Systems we can't read yet: EZLinks (Chambers Bay, Suncadia, Avalon's own site), Club Prophet `cps.golf` (Cedarcrest, Cedars at Dungeness), Agilysys (Gamble Sands, Salish Cliffs' own site), Teesnap (Loomis Trail), Total e Integrated (Palouse Ridge), Troon.

### Rate limits (important)

- **TeeItUp/GolfNow** cuts a server off after roughly 60 requests per window (Cloudflare error 1015, HTTP 429). One course costs 7 requests (one per day). So `PLATFORM_MAX_COURSES.teeitup = 7` caps each run, picking the courses checked longest ago. The two morning runs cover all 14. If you add more TeeItUp courses, either add another scheduled run or accept a slower rotation; don't raise the cap.
- Requests are paced (`PACE_MS`, `PLATFORM_PACE_MS.teeitup = 4000`), 429s back off, a platform is skipped after two courses in a row are rate-limited, and the whole run stops making requests after 15 minutes.
- Chronogolf is queried 4 times per date (group sizes 4, 3, 2, 1) to learn how many spots each time has.

## Drainage and ground conditions

- `drainage = { score, confidence, summary, sources: [{label, url}] }`.
- `score` runs 1–5: 5 means firm soon after heavy rain (sand-capped, quarry/gravel sites like The Home Course and Chambers Bay); 1 means soggy for days (floodplain, clay).
- Research from golfer reviews and write-ups: Reddit, GolfWRX, GolfPass, Greenskeeper, TripAdvisor, Cascade Golfer's "High & Dry" winter-course articles, Northwest Links, local news, and course construction history.
- Never invent evidence. If little is found, use `score: 3`, `confidence: "low"`, summary "Little golfer discussion of drainage found.", `sources: []`. Paraphrase; no long quotes. Only cite URLs actually read. Club-website claims are weak evidence; say so in the summary.
- The ground label is computed in `index.html` (`wet()`). The wetness index is `(rain that day + rain 1 day before + 0.6 × 2 days before + 0.35 × 3 days before) × retention`. Retention by score: 5→0.15, 4→0.35, 3→0.6, 2→0.85, 1→1.0. Labels: below 0.08 is Dry, below 0.25 is Damp, below 0.5 is Soft, otherwise Soggy. "Driest course each day" picks the lowest index among courses with matching open times (for private courses, among all clubs in view).

## Conventions

- `index.html` stays a single self-contained file with no build step and no frameworks. Fonts come from Google Fonts. Colors are CSS tokens on `:root` with dark-mode overrides; keep both themes working and the layout usable at phone width.
- User preferences (players, filters, region, sort) live in `localStorage` only.
- `fetch.mjs` must keep running on plain Node 20 with no `npm install`.
- The workflow's save step does `git pull --rebase -X theirs` before pushing so overlapping runs don't collide. Keep it.
- Copy on the page is plain and specific. Name things the way golfers would.
