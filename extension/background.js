const GRAPHQL_URL = "https://leetcode.com/graphql";
const USERNAME = "aarchit1999";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const STATS_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
  }
}`;

const CALENDAR_QUERY = `
query userProfileCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) {
      streak
      totalActiveDays
      submissionCalendar
    }
  }
}`;

const TOTAL_QUERY = `
query {
  allQuestionsCount { difficulty count }
}`;

async function graphql(query, variables = {}) {
  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`LeetCode API returned ${resp.status}`);
  return resp.json();
}

async function fetchFreshData() {
  const currentYear = new Date().getFullYear();

  const [statsResp, totalsResp, calPrevResp, calCurrResp] = await Promise.all([
    graphql(STATS_QUERY, { username: USERNAME }),
    graphql(TOTAL_QUERY),
    graphql(CALENDAR_QUERY, { username: USERNAME, year: currentYear - 1 }),
    graphql(CALENDAR_QUERY, { username: USERNAME, year: currentYear }),
  ]);

  const stats = statsResp.data.matchedUser.submitStatsGlobal.acSubmissionNum;
  const totals = totalsResp.data.allQuestionsCount;
  const calPrev = JSON.parse(calPrevResp.data.matchedUser.userCalendar.submissionCalendar);
  const calCurr = calCurrResp.data.matchedUser.userCalendar;
  const calendar = { ...calPrev, ...JSON.parse(calCurr.submissionCalendar) };

  return {
    stats,
    totals,
    calendar,
    streak: calCurr.streak,
    totalActiveDays: calCurr.totalActiveDays,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "GET_DATA") return;

  chrome.storage.local.get(["lc_cache"], async (result) => {
    const cached = result.lc_cache;
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      sendResponse({ ok: true, data: cached.data });
      return;
    }
    try {
      const data = await fetchFreshData();
      chrome.storage.local.set({ lc_cache: { ts: Date.now(), data } });
      sendResponse({ ok: true, data });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  });

  return true; // keeps the message channel open for async response
});
