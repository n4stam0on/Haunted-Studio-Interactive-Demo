"""
Tests for the detection engine. Run from the repo root:

    python -m unittest discover tests
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import detect  # noqa: E402

CASES = {c["id"]: c for c in detect.load("data/cases.json")}
RULES = detect.load("data/rules.json")


def flagged_rows(case_id):
    return {a["row"] for a in detect.run_rules(CASES[case_id], RULES)}


class TimeParsing(unittest.TestCase):
    def test_clock_to_minutes(self):
        self.assertEqual(detect.to_minutes("12:07 AM"), 7)
        self.assertEqual(detect.to_minutes("11:52 PM"), 23 * 60 + 52)
        self.assertEqual(detect.to_minutes("12:30 PM"), 12 * 60 + 30)

    def test_log_crossing_midnight_keeps_order(self):
        events = detect.normalize(CASES["caller"])
        stamps = [e["_ts"] for e in events]
        self.assertEqual(stamps, sorted(stamps))


class Rules(unittest.TestCase):
    def test_impossible_travel_catches_attacker(self):
        alerts = detect.run_rules(CASES["caller"], RULES)
        travel = [a for a in alerts if a["rule"] == "HS-002"]
        self.assertTrue(any("Bucharest" in a["detail"] for a in travel))

    def test_company_vpn_is_not_impossible_travel(self):
        alerts = detect.run_rules(CASES["text"], RULES)
        self.assertFalse(any(a["rule"] == "HS-002" and a["user"] == "d.nguyen" for a in alerts))

    def test_lookalike_domain_but_not_official(self):
        alerts = [a for a in detect.run_rules(CASES["text"], RULES) if a["rule"] == "HS-003"]
        self.assertEqual(len(alerts), 1)
        self.assertIn("graveyard-games-it.help", alerts[0]["detail"])

    def test_every_case_has_reasonable_recall(self):
        for cid, case in CASES.items():
            s = detect.score(case, detect.run_rules(case, RULES))
            self.assertGreaterEqual(s["recall"], 0.8, cid)

    def test_script_needs_analyst_context(self):
        # By design, some rows only make sense with the analyst notes.
        self.assertNotIn(8, flagged_rows("crypt"))   # svc-admin login from the wrong PC
        self.assertIn(10, flagged_rows("crypt"))     # nightly backup looks like exfiltration


if __name__ == "__main__":
    unittest.main()
