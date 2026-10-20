#!/usr/bin/env python3
"""
Haunted Studio detection engine.

Runs the detection rules in data/rules.json against the logs in each case
file (data/cases.json), prints the alerts, and scores the rules against the
answer key (the rows a human analyst should flag).

The same rules run in the browser (js/detect.js) as the game's Auto-Analyst,
so results here match what players see in the game.

Usage:
    python tools/detect.py                 # all cases, console summary
    python tools/detect.py --case shield   # one case
    python tools/detect.py --report        # also write reports/ALERTS.md and reports/alerts.json

Standard library only. Python 3.8+.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
DOMAIN_RE = re.compile(r"\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b", re.IGNORECASE)
NUM_RE = r"(\d[\d,]*)"


def load(path):
    with open(ROOT / path, encoding="utf-8") as f:
        return json.load(f)


def to_minutes(clock):
    """'11:52 PM' -> minutes since midnight."""
    m = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", clock.strip(), re.IGNORECASE)
    if not m:
        return None
    h, mins, ampm = int(m.group(1)), int(m.group(2)), m.group(3).upper()
    h = h % 12 + (12 if ampm == "PM" else 0)
    return h * 60 + mins


def normalize(case):
    """Turn the case's display rows into dicts keyed by column name, with a running timestamp."""
    cols = case["s2"]["cols"]
    events, last, offset = [], None, 0
    for i, row in enumerate(case["s2"]["rows"]):
        rec = dict(zip(cols, row["c"]))
        t = to_minutes(rec.get("Time", ""))
        if t is not None and last is not None and t + offset < last - 360:
            offset += 1440  # log crossed midnight
        ts = None if t is None else t + offset
        if ts is not None:
            last = ts
        rec["_i"], rec["_ts"], rec["_suspicious"] = i, ts, row["s"]
        rec["_user"] = rec.get("User") or rec.get("Account") or ""
        rec["_text"] = " ".join(row["c"])
        events.append(rec)
    return events


def place_key(location):
    """'Frankfurt, Germany (hosting provider)' -> 'frankfurt'."""
    return location.split("(")[0].split(",")[0].strip().lower()


def run_rules(case, ruleset):
    events = normalize(case)
    alerts = []

    def alert(rule, ev, detail):
        alerts.append({
            "row": ev["_i"], "rule": rule["id"], "title": rule["title"],
            "severity": rule["severity"], "technique": rule["technique"],
            "technique_name": rule["technique_name"], "detail": detail,
            "time": ev.get("Time", ""), "user": ev["_user"],
            "true_positive": ev["_suspicious"],
        })

    for rule in ruleset["rules"]:
        kind = rule["type"]

        if kind == "keyword":
            rx = re.compile(rule["pattern"], re.IGNORECASE)
            for ev in events:
                fields = [ev["_text"]] if rule["fields"] == ["*"] else [ev.get(f, "") for f in rule["fields"]]
                hit = next((f for f in fields if rx.search(f)), None)
                if hit:
                    alert(rule, ev, f"matched \"{rx.search(hit).group(0)}\"")

        elif kind == "impossible_travel":
            ignore = ruleset["travel_ignore_locations"]
            window = ruleset["travel_window_minutes"]
            last_seen = {}
            for ev in events:
                loc = ev.get("Location")
                if not loc or ev["_ts"] is None or any(x in loc.lower() for x in ignore):
                    continue
                prev = last_seen.get(ev["_user"])
                if prev and "company vpn" not in (loc + prev["Location"]).lower():
                    gap = ev["_ts"] - prev["_ts"]
                    if place_key(loc) != place_key(prev["Location"]) and gap <= window:
                        alert(rule, ev, f"{place_key(prev['Location']).title()} to {place_key(loc).title()} in {gap} min")
                last_seen[ev["_user"]] = ev

        elif kind == "lookalike_domain":
            brand, official = ruleset["brand"], ruleset["official_domain"]
            for ev in events:
                for dom in DOMAIN_RE.findall(ev.get("Event", "")):
                    d = dom.lower()
                    if brand in d and d != official and not d.endswith("." + official):
                        alert(rule, ev, f"{dom} is not {official}")
                        break

        elif kind == "volume":
            gb_rx = re.compile(NUM_RE + r"\s*GB", re.IGNORECASE)
            cnt_rx = re.compile(NUM_RE + r"\s+(" + rule["count_units"] + r")", re.IGNORECASE)
            for ev in events:
                text = ev.get("Event", "")
                gb = gb_rx.search(text)
                cnt = cnt_rx.search(text)
                if gb and int(gb.group(1).replace(",", "")) >= rule["gb_threshold"]:
                    alert(rule, ev, f"{gb.group(0)} moved")
                elif cnt and int(cnt.group(1).replace(",", "")) >= rule["count_threshold"]:
                    alert(rule, ev, f"{cnt.group(0)} in one action")

    alerts.sort(key=lambda a: (a["row"], SEVERITY_ORDER[a["severity"]]))
    return alerts


def score(case, alerts):
    flagged = {a["row"] for a in alerts}
    truth = {i for i, r in enumerate(case["s2"]["rows"]) if r["s"]}
    tp, fp, fn = len(flagged & truth), len(flagged - truth), len(truth - flagged)
    return {
        "rows": len(case["s2"]["rows"]), "suspicious": len(truth),
        "flagged": len(flagged), "true_positives": tp, "false_positives": fp, "missed": fn,
        "precision": round(tp / len(flagged), 2) if flagged else 0.0,
        "recall": round(tp / len(truth), 2) if truth else 0.0,
        "missed_rows": sorted(truth - flagged),
    }


def print_case(case, alerts, s):
    print(f"\n{case['file']}  {case['title']}  ({case['diff']})")
    print(f"  source: {case['s2']['source']}")
    for a in alerts:
        mark = "TP" if a["true_positive"] else "FP"
        tech = a["technique"] or "-"
        print(f"  [{mark}] {a['time']:>8}  {a['rule']}  {a['severity']:<8} {tech:<10} {a['title']} ({a['detail']})")
    for i in s["missed_rows"]:
        row = case["s2"]["rows"][i]["c"]
        print(f"  [MISS] {row[0]:>8}  no rule fired: {row[4] if len(row) > 4 else ' '.join(row)}")
    print(f"  precision {s['precision']:.2f}  recall {s['recall']:.2f}  "
          f"({s['true_positives']} caught, {s['false_positives']} false alarms, {s['missed']} missed)")


def write_report(results):
    out = ROOT / "reports"
    out.mkdir(exist_ok=True)
    (out / "alerts.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    lines = ["# Haunted Studio detection report", "",
             "Generated by `tools/detect.py` from `data/rules.json` and `data/cases.json`.", "",
             "| Case | Difficulty | Suspicious rows | Caught | False alarms | Missed | Precision | Recall |",
             "|---|---|---|---|---|---|---|---|"]
    for r in results:
        s = r["score"]
        lines.append(f"| {r['title']} | {r['difficulty']} | {s['suspicious']} | {s['true_positives']} | "
                     f"{s['false_positives']} | {s['missed']} | {s['precision']:.2f} | {s['recall']:.2f} |")
    for r in results:
        lines += ["", f"## {r['title']}", "", "| Time | Rule | Severity | ATT&CK | Alert | Verdict |", "|---|---|---|---|---|---|"]
        for a in r["alerts"]:
            lines.append(f"| {a['time']} | {a['rule']} | {a['severity']} | {a['technique'] or '-'} | "
                         f"{a['title']}: {a['detail']} | {'True positive' if a['true_positive'] else 'False positive'} |")
    lines += ["", "Rules flag patterns. Analysts supply context: travel notes, policies, and schedules",
              "explain most false positives and most misses in this report.", ""]
    (out / "ALERTS.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\nWrote {out / 'ALERTS.md'} and {out / 'alerts.json'}")


def main():
    ap = argparse.ArgumentParser(description="Run Haunted Studio detection rules against case logs.")
    ap.add_argument("--case", help="case id (caller, launcher, text, shield, crypt)")
    ap.add_argument("--report", action="store_true", help="write reports/ALERTS.md and reports/alerts.json")
    args = ap.parse_args()

    cases, ruleset = load("data/cases.json"), load("data/rules.json")
    if args.case:
        cases = [c for c in cases if c["id"] == args.case]
        if not cases:
            ap.error(f"unknown case '{args.case}'")

    results = []
    for case in cases:
        alerts = run_rules(case, ruleset)
        s = score(case, alerts)
        print_case(case, alerts, s)
        results.append({"id": case["id"], "title": case["title"], "difficulty": case["diff"], "alerts": alerts, "score": s})
    if args.report:
        write_report(results)


if __name__ == "__main__":
    main()
