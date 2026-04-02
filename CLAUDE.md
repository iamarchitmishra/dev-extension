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
│   └── server.py          ← Python stdlib HTTP server (no dependencies)
└── extension/
    ├── manifest.json       ← Chrome MV3, overrides new tab
    ├── newtab.html         ← Page structure
    ├── newtab.js           ← Data fetching + SVG gauge + heatmap rendering
    └── newtab.css          ← Dark GitHub-style theme
```

### Why a local proxy?

LeetCode's GraphQL API (`leetcode.com/graphql`) blocks cross-origin requests from browser extensions (CORS). A small Python server runs on `localhost:7337`, fetches from LeetCode server-to-server (no CORS restriction), caches responses for 1 hour, and serves them to the extension.

**To start the proxy:**
```bash
python3 proxy/server.py
```

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

The proxy fetches calendar data for both the current and previous year, merges them, and returns everything in one `/data` endpoint.

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

## Key decisions made

- **Python stdlib only** — no Flask, no pip installs. The proxy uses `http.server` + `urllib` so it works out of the box on any Mac.
- **No authentication needed** — Archit's LeetCode profile is public; all queries work without session cookies.
- **Chrome extension only (for now)** — an Übersicht desktop widget was discussed as a future addition; it would read from the same proxy.
- **Heatmap is month-grouped, not week-ribbon** — matches LeetCode's own calendar layout.
- **No hardcoded problem counts** — all totals (935 easy, 2033 medium, etc.) are fetched live from `allQuestionsCount` and will stay accurate as LeetCode adds problems.

## Potential future features

- Übersicht desktop widget (reads from same `localhost:7337` proxy)
- Auto-start proxy on Mac login via `launchd`
- Show recent submission list
- Daily problem suggestion
- Ranking / percentile display
