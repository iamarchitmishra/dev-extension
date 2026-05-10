# LeetCode Dashboard

A Chrome extension that replaces the new tab page with a personal LeetCode stats dashboard. Built by Archit Mishra (LeetCode: `aarchit1999`).

## What this does

Every time a new tab is opened in Chrome, it shows:
- A circular gauge (SVG, LeetCode-style) showing problems solved across Easy / Medium / Hard
- A 12-month submission heatmap grouped by calendar month

## Architecture

```
lc_project/
├── proxy/
│   └── server.py          ← OLD approach (unused — kept for reference)
└── extension/
    ├── manifest.json       ← Chrome MV3, overrides new tab, declares host_permissions
    ├── background.js       ← Service worker: fetches LeetCode API + caches in chrome.storage
    ├── newtab.html         ← Page structure
    ├── newtab.js           ← Requests data from background, renders SVG gauge + heatmap
    └── newtab.css          ← Dark GitHub-style theme
```

### How API access works (no proxy needed)

LeetCode's GraphQL API (`leetcode.com/graphql`) blocks cross-origin requests from normal web pages (CORS). Chrome extensions can bypass this entirely by declaring `host_permissions` in `manifest.json` — the browser grants the service worker permission to make cross-origin requests to those hosts without CORS restrictions.

`manifest.json` declares:
```json
"host_permissions": ["https://leetcode.com/*"]
```

`background.js` (the service worker) calls `https://leetcode.com/graphql` directly via `fetch`. Responses are cached for 1 hour in `chrome.storage.local`.

`newtab.js` never touches the API directly — it sends a `{ type: "GET_DATA" }` message to the background service worker via `chrome.runtime.sendMessage` and renders whatever comes back.

**The old `proxy/server.py` is no longer used.** It stays in the repo as a reference but the extension does not depend on it.

**To load the extension:**
1. `chrome://extensions` → Developer mode ON → Load unpacked → select `extension/` folder
2. Refresh the extension card after any code changes

## Data sources

All data comes from LeetCode's internal GraphQL API (unofficial but stable):

| Query | What it returns |
|---|---|
| `getUserProfile` | Problems solved by difficulty (Easy/Medium/Hard/All) |
| `userProfileCalendar` | Day-by-day submission counts, streak, active days |
| `allQuestionsCount` | Total problems available per difficulty |

`background.js` fires all three queries in parallel (`Promise.all`), fetches calendar data for both the current and previous year, merges them, and responds to the newtab page in one message.

## Caching

- Implemented in the background service worker using `chrome.storage.local`
- Cache key: `lc_cache`, stores `{ ts, data }`
- TTL: 1 hour — stale cache is used if fresh fetch fails

## Gauge design (SVG)

Closely mirrors the LeetCode profile gauge:
- 270° arc, starting at 225° clockwise from top (7:30 position), 90° gap at the bottom
- Arc divided into 3 sections proportional to **total problems per difficulty** (not solved count)
- 3° gap between each section boundary
- Within each section: muted color fills the full section, bright color overlays the solved portion (`solvedCount / totalInDifficulty × sectionDegrees`)
- Because solve rates are low, the bright overlay is short and `stroke-linecap: round` renders it as a dot — matching LeetCode's look
- All proportions are calculated from API data, nothing hardcoded

Colors:
- Easy: bright `#00b8a3`, muted `#0d5c57`
- Medium: bright `#ffa116`, muted `#6b5a00`
- Hard: bright `#ff375f`, muted `#6b1f2e`

## Heatmap design

- Shows last 12 calendar months (not a rolling 52-week ribbon)
- Each month is its own block of week-columns with a 10px gap between months
- Month labels at the bottom, centered under each block
- Weeks run Sun→Sat (top→bottom), months run left→right
- Header shows total submissions in past year, active days, and streak
- Empty cells (before month start / after today) are transparent
- Streak and active-days stats are computed locally in `newtab.js` from the calendar data (not from the API's streak field, which can differ due to timezone)

## Key decisions made

- **No local proxy** — `host_permissions` in the manifest lets the service worker call LeetCode's API directly from the extension, bypassing CORS without any external server.
- **Background service worker handles all fetching** — `newtab.js` only renders; it sends a message to `background.js` and waits for the response. This keeps the service worker alive across tab opens and lets the cache persist.
- **`chrome.storage.local` for caching** — survives browser restarts, shared across tabs, no server needed.
- **No authentication needed** — Archit's LeetCode profile is public; all queries work without session cookies.
- **Chrome extension only (for now)** — an Übersicht desktop widget was discussed as a future addition.
- **Heatmap is month-grouped, not week-ribbon** — matches LeetCode's own calendar layout.
- **No hardcoded problem counts** — all totals are fetched live from `allQuestionsCount`.

## Potential future features

- Übersicht desktop widget
- Auto-start (was needed for the proxy; no longer necessary since there's no server to run)
- Show recent submission list
- Daily problem suggestion
- Ranking / percentile display
- Publish to Chrome Web Store
