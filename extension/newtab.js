const PROXY_URL = "http://localhost:7337/data";

// ── Gauge ────────────────────────────────────────────────────────────────────

function polarToXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

function arcPath(cx, cy, r, fromDeg, toDeg) {
  const sweep = ((toDeg - fromDeg) + 360) % 360;
  if (sweep < 0.01) return "";
  const s = polarToXY(cx, cy, r, fromDeg);
  const e = polarToXY(cx, cy, r, toDeg);
  const large = sweep > 180 ? 1 : 0;
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
}

function buildGauge(solved, totals) {
  const CX = 100, CY = 100, R = 82, SW = 10;
  const START = 225;        // degrees clockwise from top (7:30 position)
  const TOTAL_SWEEP = 270;  // degrees, leaving 90° gap at bottom
  const GAP = 3;            // degrees of empty space between sections

  const totalMap = {};
  totals.forEach((t) => (totalMap[t.difficulty] = t.count));
  const solvedMap = {};
  solved.forEach((s) => (solvedMap[s.difficulty] = s.count));

  const totalAll = totalMap["All"] || 1;

  const difficulties = [
    { key: "Easy",   bright: "#00b8a3", muted: "#0d5c57" },
    { key: "Medium", bright: "#ffa116", muted: "#6b5a00" },
    { key: "Hard",   bright: "#ff375f", muted: "#6b1f2e" },
  ];

  const makePath = (d, stroke) =>
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${SW}" stroke-linecap="round"/>`;

  // Effective sweep after subtracting the 2 gaps between 3 sections
  const effectiveSweep = TOTAL_SWEEP - GAP * (difficulties.length - 1);

  const paths = [];
  let sectionStart = START;

  for (let i = 0; i < difficulties.length; i++) {
    const diff = difficulties[i];
    const total = totalMap[diff.key] || 0;
    const solvedCount = solvedMap[diff.key] || 0;

    // Section width proportional to this difficulty's share of all problems
    const sectionDeg = (total / totalAll) * effectiveSweep;
    const sectionEnd = sectionStart + sectionDeg;

    // Solved portion proportional to solve rate within this difficulty
    const solvedDeg = total > 0 ? (solvedCount / total) * sectionDeg : 0;
    const solvedEnd = sectionStart + solvedDeg;

    // Draw full section in muted color first, then solved portion in bright on top
    if (sectionDeg > 0.1) {
      paths.push(makePath(arcPath(CX, CY, R, sectionStart, sectionEnd), diff.muted));
    }
    if (solvedDeg > 0) {
      paths.push(makePath(arcPath(CX, CY, R, sectionStart, solvedEnd), diff.bright));
    }

    // Advance past this section + gap (no gap after the last section)
    sectionStart = sectionEnd + (i < difficulties.length - 1 ? GAP : 0);
  }

  document.getElementById("gauge-svg").innerHTML = paths.join("\n");

  document.getElementById("gauge-solved").textContent = solvedMap["All"] ?? "—";
  document.getElementById("gauge-total").textContent = totalAll;

  difficulties.forEach((diff) => {
    const s = solvedMap[diff.key] ?? "—";
    const t = totalMap[diff.key] ?? "—";
    document.getElementById(`${diff.key.toLowerCase()}-count`).textContent = `${s} / ${t}`;
  });
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

function getLevel(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function utcMidnight(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

function buildHeatmap(calendarData) {
  const grid = document.getElementById("heatmap");
  grid.innerHTML = "";

  const now = new Date();
  const today = utcMidnight(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Count submissions in the past year for the header
  const oneYearAgoMs = today.getTime() - 365 * 24 * 3600 * 1000;
  let totalSubmissions = 0;
  for (const [ts, count] of Object.entries(calendarData)) {
    if (parseInt(ts) * 1000 >= oneYearAgoMs) totalSubmissions += count;
  }
  document.getElementById("submission-count").textContent =
    `${totalSubmissions} submissions in the past year`;

  // Show 12 months: from (currentMonth - 11) through current month
  const startYear = today.getUTCFullYear();
  const startMonth = today.getUTCMonth() - 11; // JS handles negative months correctly

  for (let mi = 0; mi < 12; mi++) {
    const monthDate = utcMidnight(startYear, startMonth + mi, 1);
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();

    const firstOfMonth = utcMidnight(year, month, 1);
    const lastOfMonth = utcMidnight(year, month + 1, 0); // last day of month
    const effectiveLast = lastOfMonth > today ? today : lastOfMonth;

    // Build week columns for this month
    // Week starts on Sunday (dow 0)
    const leadingEmpties = firstOfMonth.getUTCDay(); // 0=Sun, empties before the 1st

    const weeks = [];
    let week = new Array(leadingEmpties).fill(null);

    const d = new Date(firstOfMonth);
    while (d <= effectiveLast) {
      const ts = String(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
      const count = calendarData[ts] || 0;
      week.push({ count, date: new Date(d) });

      if (d.getUTCDay() === 6) {
        weeks.push(week);
        week = [];
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    // Build DOM
    const block = document.createElement("div");
    block.className = "month-block";

    const weeksEl = document.createElement("div");
    weeksEl.className = "month-weeks";

    weeks.forEach((wk) => {
      const col = document.createElement("div");
      col.className = "week-col";
      for (let i = 0; i < 7; i++) {
        const cell = document.createElement("div");
        const day = wk[i];
        if (!day) {
          cell.className = "cell empty";
        } else {
          cell.className = `cell l${getLevel(day.count)}`;
          cell.title = `${day.date.toISOString().slice(0, 10)}: ${day.count} submission${day.count !== 1 ? "s" : ""}`;
        }
        col.appendChild(cell);
      }
      weeksEl.appendChild(col);
    });

    const label = document.createElement("div");
    label.className = "month-label";
    label.textContent = firstOfMonth.toLocaleString("default", { month: "short" });

    block.appendChild(weeksEl);
    block.appendChild(label);
    grid.appendChild(block);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function loadData() {
  const loading = document.getElementById("loading");
  const content = document.getElementById("content");
  const errorEl = document.getElementById("error");

  try {
    const resp = await fetch(PROXY_URL);
    if (!resp.ok) throw new Error(`Proxy returned ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    buildGauge(data.stats, data.totals);
    buildHeatmap(data.calendar);

    document.getElementById("streak").textContent = data.streak ?? "—";
    document.getElementById("active").textContent = data.totalActiveDays ?? "—";

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    loading.classList.add("hidden");
    errorEl.textContent = err.message.includes("Failed to fetch")
      ? "Proxy not running. Start it with: python3 proxy/server.py"
      : `Error: ${err.message}`;
    errorEl.classList.remove("hidden");
  }
}

loadData();
