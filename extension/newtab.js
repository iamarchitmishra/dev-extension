const PROXY_URL = "http://localhost:7337/data";
const DAYS_TO_SHOW = 365;

// Color levels based on submission count
function getLevel(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function getUTCDayTimestamp(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000;
}

function buildHeatmap(calendarData) {
  const grid = document.getElementById("heatmap");
  const monthLabels = document.getElementById("month-labels");
  grid.innerHTML = "";
  monthLabels.innerHTML = "";

  const today = new Date();
  // Align to the most recent Sunday so the grid fills neatly
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDow = endDate.getUTCDay(); // 0=Sun ... 6=Sat
  // We want to show exactly 53 weeks (371 days) ending on the last Saturday >= today
  const daysToSaturday = (6 - endDow + 7) % 7;
  const gridEnd = new Date(endDate);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + daysToSaturday);

  // Start 52 weeks (364 days) before gridEnd's Sunday
  const gridStart = new Date(gridEnd);
  gridStart.setUTCDate(gridStart.getUTCDate() - 364);
  // Snap back to Sunday
  const startDow = gridStart.getUTCDay();
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

  const weeks = [];
  let current = new Date(gridStart);
  let weekCells = [];
  let lastMonth = -1;
  const monthPositions = []; // { label, weekIndex }
  let weekIndex = 0;

  while (current <= gridEnd) {
    const ts = String(getUTCDayTimestamp(current));
    const count = calendarData[ts] || 0;
    const isFuture = current > endDate;
    const month = current.getUTCMonth();

    if (month !== lastMonth && current.getUTCDate() <= 7) {
      monthPositions.push({ label: current.toLocaleString("default", { month: "short" }), weekIndex });
      lastMonth = month;
    }

    weekCells.push({ count, isFuture, date: new Date(current) });

    if (current.getUTCDay() === 6) {
      weeks.push(weekCells);
      weekCells = [];
      weekIndex++;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  if (weekCells.length > 0) weeks.push(weekCells);

  // Render month labels
  weeks.forEach((_, i) => {
    const pos = monthPositions.find((m) => m.weekIndex === i);
    const label = document.createElement("span");
    label.textContent = pos ? pos.label : "";
    monthLabels.appendChild(label);
  });

  // Render grid — each week is a column of 7 cells
  weeks.forEach((week) => {
    const col = document.createElement("div");
    col.className = "week-col";

    // Fill empty slots if week doesn't start on Sunday
    for (let i = 0; i < 7; i++) {
      const cell = document.createElement("div");
      const day = week[i];
      if (!day) {
        cell.className = "cell empty";
      } else {
        const level = day.isFuture ? "future" : getLevel(day.count);
        cell.className = `cell level-${level}`;
        cell.title = `${day.date.toISOString().slice(0, 10)}: ${day.count} submission${day.count !== 1 ? "s" : ""}`;
      }
      col.appendChild(cell);
    }

    grid.appendChild(col);
  });
}

async function loadData() {
  const loading = document.getElementById("loading");
  const content = document.getElementById("content");
  const errorEl = document.getElementById("error");

  try {
    const resp = await fetch(PROXY_URL);
    if (!resp.ok) throw new Error(`Proxy returned ${resp.status}`);
    const data = await resp.json();

    if (data.error) throw new Error(data.error);

    // Fill stats
    const counts = {};
    data.stats.forEach((s) => (counts[s.difficulty] = s.count));
    document.getElementById("total").textContent = counts["All"] ?? "—";
    document.getElementById("easy").textContent = counts["Easy"] ?? "—";
    document.getElementById("medium").textContent = counts["Medium"] ?? "—";
    document.getElementById("hard").textContent = counts["Hard"] ?? "—";
    document.getElementById("streak").textContent = data.streak ?? "—";
    document.getElementById("active").textContent = data.totalActiveDays ?? "—";

    buildHeatmap(data.calendar);

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    loading.classList.add("hidden");
    errorEl.textContent =
      err.message.includes("Failed to fetch")
        ? "Proxy not running. Start it with: python3 proxy/server.py"
        : `Error: ${err.message}`;
    errorEl.classList.remove("hidden");
  }
}

loadData();
