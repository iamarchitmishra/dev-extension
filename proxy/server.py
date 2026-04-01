import json
import time
import datetime
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

USERNAME = "aarchit1999"
PORT = 7337
CACHE_TTL = 3600  # seconds (1 hour)

GRAPHQL_URL = "https://leetcode.com/graphql"
HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Origin": "https://leetcode.com",
}

STATS_QUERY = """
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
"""

CALENDAR_QUERY = """
query userProfileCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) {
      streak
      totalActiveDays
      submissionCalendar
    }
  }
}
"""

TOTAL_QUERY = """
query {
  allQuestionsCount {
    difficulty
    count
  }
}
"""

_cache = {"data": None, "ts": 0}


def graphql(query, variables):
    payload = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(GRAPHQL_URL, data=payload, headers=HEADERS, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def fetch_data():
    current_year = datetime.datetime.now().year
    years = [current_year - 1, current_year]

    stats_resp = graphql(STATS_QUERY, {"username": USERNAME})
    stats = stats_resp["data"]["matchedUser"]["submitStatsGlobal"]["acSubmissionNum"]

    totals_resp = graphql(TOTAL_QUERY, {})
    totals = totals_resp["data"]["allQuestionsCount"]

    merged_calendar = {}
    streak = 0
    total_active_days = 0

    for year in years:
        cal_resp = graphql(CALENDAR_QUERY, {"username": USERNAME, "year": year})
        cal_data = cal_resp["data"]["matchedUser"]["userCalendar"]
        merged_calendar.update(json.loads(cal_data["submissionCalendar"]))
        # Use the most recent year's streak and total
        streak = cal_data["streak"]
        total_active_days = cal_data["totalActiveDays"]

    return {
        "stats": stats,
        "totals": totals,
        "calendar": merged_calendar,
        "streak": streak,
        "totalActiveDays": total_active_days,
    }


def get_data():
    now = time.time()
    if _cache["data"] is None or now - _cache["ts"] > CACHE_TTL:
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Fetching fresh data from LeetCode...")
        _cache["data"] = fetch_data()
        _cache["ts"] = now
        print("Done.")
    return _cache["data"]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/data":
            self.send_response(404)
            self.end_headers()
            return

        try:
            data = get_data()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            print(f"Error: {e}")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        # Suppress per-request logs, we log manually above
        pass


if __name__ == "__main__":
    print(f"LeetCode proxy running on http://localhost:{PORT}")
    print(f"Tracking user: {USERNAME}")
    print(f"Cache TTL: {CACHE_TTL}s")
    HTTPServer(("localhost", PORT), Handler).serve_forever()
