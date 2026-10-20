/*
 * Haunted Studio detection engine (browser).
 * Mirrors tools/detect.py rule for rule, using the same data/rules.json,
 * so the in-game Auto-Analyst matches the Python report.
 */
(function () {
  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const DOMAIN_RE = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;
  const NUM = "(\\d[\\d,]*)";

  function toMinutes(clock) {
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(String(clock).trim());
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === "PM") h += 12;
    return h * 60 + parseInt(m[2], 10);
  }

  function normalize(c) {
    const cols = c.s2.cols;
    let last = null, offset = 0;
    return c.s2.rows.map((row, i) => {
      const rec = {};
      cols.forEach((name, k) => { rec[name] = row.c[k]; });
      const t = toMinutes(rec.Time || "");
      if (t !== null && last !== null && t + offset < last - 360) offset += 1440; // crossed midnight
      const ts = t === null ? null : t + offset;
      if (ts !== null) last = ts;
      rec._i = i; rec._ts = ts; rec._suspicious = row.s;
      rec._user = rec.User || rec.Account || "";
      rec._text = row.c.join(" ");
      return rec;
    });
  }

  const placeKey = loc => loc.split("(")[0].split(",")[0].trim().toLowerCase();
  const title = s => s.replace(/\b\w/g, ch => ch.toUpperCase());

  function run(c, ruleset) {
    const events = normalize(c);
    const alerts = [];
    const alert = (rule, ev, detail) => alerts.push({
      row: ev._i, rule: rule.id, title: rule.title, severity: rule.severity,
      technique: rule.technique, technique_name: rule.technique_name, detail,
      time: ev.Time || "", user: ev._user, true_positive: ev._suspicious
    });

    for (const rule of ruleset.rules) {
      if (rule.type === "keyword") {
        const rx = new RegExp(rule.pattern, "i");
        for (const ev of events) {
          const fields = rule.fields[0] === "*" ? [ev._text] : rule.fields.map(f => ev[f] || "");
          const hit = fields.find(f => rx.test(f));
          if (hit) alert(rule, ev, `matched "${rx.exec(hit)[0]}"`);
        }
      } else if (rule.type === "impossible_travel") {
        const lastSeen = {};
        for (const ev of events) {
          const loc = ev.Location;
          if (!loc || ev._ts === null || ruleset.travel_ignore_locations.some(x => loc.toLowerCase().includes(x))) continue;
          const prev = lastSeen[ev._user];
          if (prev && !(loc + prev.Location).toLowerCase().includes("company vpn")) {
            const gap = ev._ts - prev._ts;
            if (placeKey(loc) !== placeKey(prev.Location) && gap <= ruleset.travel_window_minutes)
              alert(rule, ev, `${title(placeKey(prev.Location))} to ${title(placeKey(loc))} in ${gap} min`);
          }
          lastSeen[ev._user] = ev;
        }
      } else if (rule.type === "lookalike_domain") {
        for (const ev of events) {
          const doms = (ev.Event || "").match(DOMAIN_RE) || [];
          for (const dom of doms) {
            const d = dom.toLowerCase();
            if (d.includes(ruleset.brand) && d !== ruleset.official_domain && !d.endsWith("." + ruleset.official_domain)) {
              alert(rule, ev, `${dom} is not ${ruleset.official_domain}`);
              break;
            }
          }
        }
      } else if (rule.type === "volume") {
        const gbRx = new RegExp(NUM + "\\s*GB", "i");
        const cntRx = new RegExp(NUM + "\\s+(" + rule.count_units + ")", "i");
        for (const ev of events) {
          const text = ev.Event || "";
          const gb = gbRx.exec(text), cnt = cntRx.exec(text);
          if (gb && parseInt(gb[1].replace(/,/g, ""), 10) >= rule.gb_threshold) alert(rule, ev, `${gb[0]} moved`);
          else if (cnt && parseInt(cnt[1].replace(/,/g, ""), 10) >= rule.count_threshold) alert(rule, ev, `${cnt[0]} in one action`);
        }
      }
    }
    alerts.sort((a, b) => a.row - b.row || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    return alerts;
  }

  function score(c, alerts) {
    const flagged = new Set(alerts.map(a => a.row));
    const truth = new Set(c.s2.rows.map((r, i) => r.s ? i : -1).filter(i => i >= 0));
    const tp = [...flagged].filter(i => truth.has(i)).length;
    return {
      flagged, truth, tp,
      fp: flagged.size - tp,
      missed: [...truth].filter(i => !flagged.has(i))
    };
  }

  window.Detect = { run, score };
})();
