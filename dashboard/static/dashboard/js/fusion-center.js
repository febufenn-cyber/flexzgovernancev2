/* fusion-center.js — State Fusion Center COP layer.
   M1 Readiness level · M2 Alert crawl · M4 Ops journal · M5 Feed-integrity board.
   Client-only: derives everything from /api/map (x3) and /api/lineage (x3).
   Self-contained; never edits dashboard.js (listens for the "grid:feeds" event). */
(function () {
  "use strict";

  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var DEPTS = ["police", "health", "pds"];
  var DEPT_META = {
    police: { label: "Police", color: "#f5c542" },
    health: { label: "Health", color: "#f26da8" },
    pds: { label: "PDS", color: "#38bdf8" },
  };
  var STATUS = {
    green: { label: "Normal", color: "#22d39b" },
    amber: { label: "Watch", color: "#f5b12a" },
    red: { label: "Critical", color: "#f23a3a" },
  };

  // DEFCON / NTAS-style posture: level 5 (calm) -> 1 (severe).
  var LEVELS = [
    null,
    { name: "SEVERE", color: "#f23a3a" },      // 1  (status red)
    { name: "HIGH", color: "#f5851f" },        // 2
    { name: "SIGNIFICANT", color: "#f5b12a" }, // 3  (status amber)
    { name: "ELEVATED", color: "#9bd450" },    // 4
    { name: "GUARDED", color: "#22d39b" },     // 5  (status green)
  ];

  function el(sel) { return document.querySelector(sel); }
  function esc(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function compact(n) {
    n = Number(n);
    if (!isFinite(n)) return "0";
    if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
    if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(1) + " L";
    return new Intl.NumberFormat("en-IN").format(n);
  }
  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    });
  }
  function istTime() {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit",
      second: "2-digit", hour12: false,
    }).format(new Date());
  }
  function syncAgo(s) {
    s = Number(s);
    if (!isFinite(s)) return "—";
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    return Math.round(s / 3600) + "h ago";
  }

  var state = { feeds: null, lineage: null };

  /* ---------------- M1 — Operational Readiness Level ---------------- */
  function readinessScore(feeds) {
    var red = 0, amber = 0, byDept = [];
    feeds.forEach(function (f) {
      var c = (f.summary && f.summary.counts) || { red: 0, amber: 0 };
      red += c.red || 0;
      amber += c.amber || 0;
      byDept.push({ id: f.department, red: c.red || 0, amber: c.amber || 0 });
    });
    var score = red * 3 + amber;
    var level = score >= 120 ? 1 : score >= 90 ? 2 : score >= 60 ? 3 : score >= 30 ? 4 : 5;
    byDept.sort(function (a, b) { return b.red - a.red; });
    return { score: score, level: level, red: red, amber: amber, byDept: byDept };
  }

  function renderReadiness(feeds) {
    var host = el("#readiness");
    if (!host) return;
    var r = readinessScore(feeds);
    var lv = LEVELS[r.level];
    var segs = "";
    for (var i = 5; i >= 1; i--) {
      var on = i >= r.level; // fill from calm side up to current severity
      segs += '<span class="rl-seg' + (on ? " on" : "") + '"' +
        (i === r.level ? ' style="background:' + lv.color + ';box-shadow:0 0 9px ' + lv.color + '"' : "") +
        "></span>";
    }
    var drivers = r.byDept.filter(function (d) { return d.red > 0; })
      .map(function (d) { return DEPT_META[d.id].label + " " + d.red + " crit"; })
      .join(" · ") || "All departments nominal";
    host.style.setProperty("--rl-c", lv.color);
    host.innerHTML =
      '<span class="rl-arrow" aria-hidden="true">▲</span>' +
      '<span class="rl-main">' +
        '<span class="rl-k">Operational Readiness</span>' +
        '<span class="rl-v">LEVEL ' + r.level + ' — ' + lv.name + '</span>' +
      "</span>" +
      '<span class="rl-bar" aria-hidden="true">' + segs + "</span>" +
      '<span class="rl-drivers">' + esc(drivers) + "</span>";
    host.setAttribute("aria-label",
      "Operational readiness level " + r.level + " " + lv.name + ". " + drivers + ". Open watch floor.");
  }

  /* ---------------- M2 — Statewide alert crawl ---------------- */
  function buildAlerts(feeds) {
    var rows = [];
    feeds.forEach(function (f) {
      var meta = DEPT_META[f.department];
      (f.districts || []).forEach(function (d) {
        if (d.status === "red" || d.status === "amber") {
          rows.push({
            dept: f.department, deptLabel: meta.label, color: meta.color,
            name: d.name, code: d.code, status: d.status,
            value: d.display_value, metric: f.metric_label,
          });
        }
      });
    });
    rows.sort(function (a, b) {
      if (a.status !== b.status) return a.status === "red" ? -1 : 1;
      return 0;
    });
    return rows;
  }

  function renderCrawl(feeds) {
    var track = el("#alert-crawl-track");
    if (!track) return;
    var rows = buildAlerts(feeds);
    if (!rows.length) {
      track.innerHTML = '<span class="crawl-item"><b>●</b> All districts nominal across Police, Health and PDS.</span>';
      track.classList.add("crawl-static");
      return;
    }
    track.classList.remove("crawl-static");
    var html = rows.map(function (r) {
      var sc = STATUS[r.status].color;
      return '<a class="crawl-item" href="/district/' + encodeURIComponent(r.code) +
        "/?dept=" + r.dept + '" style="--cc:' + r.color + '">' +
        '<span class="crawl-dot" style="background:' + sc + ';box-shadow:0 0 8px ' + sc + '"></span>' +
        '<b style="color:' + sc + '">' + STATUS[r.status].label.toUpperCase() + "</b> " +
        '<span class="crawl-dept" style="color:' + r.color + '">' + esc(r.deptLabel) + "</span> " +
        esc(r.name) + " — " + esc(r.value) +
        "</a>";
    }).join('<span class="crawl-sep">//</span>');
    // duplicate for seamless loop
    track.innerHTML = html + '<span class="crawl-sep">//</span>' + html;
  }

  /* ---------------- M5 — Feed-integrity board ---------------- */
  function renderFeedBoard(lineageByDept) {
    var board = el("#feed-board");
    var rollup = el("#feed-rollup");
    if (!board) return;
    var total = 0, degraded = 0, html = "";
    DEPTS.forEach(function (dept) {
      var data = lineageByDept[dept];
      if (!data) return;
      var nodes = (data.sources || []).slice();
      if (data.ingestion) nodes.push(data.ingestion);
      if (data.kpi) nodes.push(data.kpi);
      html += '<div class="fb-group"><div class="fb-dept" style="--dc:' +
        DEPT_META[dept].color + '">' + esc(DEPT_META[dept].label) + "</div>";
      nodes.forEach(function (n) {
        total++;
        var st = n.status || "live";
        if (st !== "live") degraded++;
        var sc = st === "offline" ? STATUS.red.color : st === "delayed" ? STATUS.amber.color : STATUS.green.color;
        html += '<div class="fb-row">' +
          '<span class="fb-dot" style="background:' + sc + ';box-shadow:0 0 8px ' + sc + '"></span>' +
          '<span class="fb-name">' + esc(n.icon || "") + " " + esc(n.name) + "</span>" +
          '<span class="fb-meta">' + compact(n.records_today) + " rec · " + syncAgo(n.last_sync_seconds) +
          " · " + (n.latency_ms || 0) + "ms</span>" +
          '<span class="fb-st" style="color:' + sc + '">' + st.toUpperCase() + "</span>" +
          "</div>";
      });
      html += "</div>";
    });
    board.innerHTML = html;
    if (rollup) {
      var ok = degraded === 0;
      rollup.textContent = ok ? "SYSTEMS NOMINAL" : "DEGRADED (" + degraded + "/" + total + ")";
      rollup.className = "feed-rollup " + (ok ? "ok" : "warn");
    }
  }

  /* ---------------- M4 — Live ops journal ---------------- */
  var journalPool = [];
  var journalTimer = null;

  function buildJournalPool(feeds, lineageByDept) {
    var pool = [];
    feeds.forEach(function (f) {
      var meta = DEPT_META[f.department];
      var top = (f.districts || []).find(function (d) { return d.is_top; });
      if (top) {
        pool.push({ sev: "red", tag: "ESCALATION", dept: meta.label, dc: meta.color,
          text: top.name + " leads " + f.metric_label.toLowerCase() + " at " + top.display_value + "." });
      }
      (f.districts || []).filter(function (d) { return d.status === "red"; })
        .slice(0, 5).forEach(function (d) {
          pool.push({ sev: "red", tag: "CRITICAL", dept: meta.label, dc: meta.color,
            text: d.name + " breached " + f.metric_label.toLowerCase() + " threshold (" + d.display_value + ")." });
        });
      (f.districts || []).filter(function (d) { return d.status === "amber"; })
        .slice(0, 3).forEach(function (d) {
          pool.push({ sev: "amber", tag: "WATCH", dept: meta.label, dc: meta.color,
            text: d.name + " elevated on " + f.metric_label.toLowerCase() + " (" + d.display_value + ")." });
        });
    });
    DEPTS.forEach(function (dept) {
      var data = lineageByDept[dept];
      if (!data) return;
      (data.sources || []).forEach(function (s) {
        if (s.status === "offline") {
          pool.push({ sev: "red", tag: "FEED OFFLINE", dept: DEPT_META[dept].label, dc: DEPT_META[dept].color,
            text: s.name + " feed is offline — ingestion gap on " + DEPT_META[dept].label + "." });
        } else if (s.status === "delayed") {
          pool.push({ sev: "amber", tag: "FEED DELAY", dept: DEPT_META[dept].label, dc: DEPT_META[dept].color,
            text: s.name + " sync delayed — latency " + s.latency_ms + "ms, last " + syncAgo(s.last_sync_seconds) + "." });
        } else {
          pool.push({ sev: "green", tag: "SYNC OK", dept: DEPT_META[dept].label, dc: DEPT_META[dept].color,
            text: s.name + " streaming — " + compact(s.records_today) + " records today." });
        }
      });
    });
    // deterministic-ish shuffle by severity weight then interleave
    pool.sort(function (a, b) {
      var w = { red: 0, amber: 1, green: 2 };
      return w[a.sev] - w[b.sev];
    });
    return pool;
  }

  function journalLine(ev, time) {
    return '<div class="oj-row sev-' + ev.sev + '">' +
      '<span class="oj-time mono">' + time + "</span>" +
      '<span class="oj-tag" style="--ec:' + ev.dc + '">' + esc(ev.tag) + "</span>" +
      '<span class="oj-dept">' + esc(ev.dept) + "</span>" +
      '<span class="oj-text">' + esc(ev.text) + "</span>" +
      "</div>";
  }

  function seedJournal() {
    var log = el("#ops-journal");
    if (!log || !journalPool.length) return;
    var now = Date.now();
    var html = "";
    // backlog: 8 most-recent synthetic events with descending timestamps
    for (var i = 0; i < Math.min(8, journalPool.length); i++) {
      var t = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).format(new Date(now - i * 47000));
      html += journalLine(journalPool[i], t);
    }
    log.innerHTML = html;
  }

  var journalCursor = 0;
  function streamJournal() {
    var log = el("#ops-journal");
    if (!log || !journalPool.length) return;
    journalCursor = (journalCursor + 1) % journalPool.length;
    var ev = journalPool[journalCursor];
    var row = document.createElement("div");
    row.innerHTML = journalLine(ev, istTime());
    var node = row.firstChild;
    node.classList.add("oj-new");
    log.insertBefore(node, log.firstChild);
    while (log.children.length > 60) log.removeChild(log.lastChild);
  }

  function startJournal() {
    if (journalTimer || reduce) return;
    journalTimer = window.setInterval(streamJournal, 4200);
  }
  function stopJournal() {
    if (journalTimer) { window.clearInterval(journalTimer); journalTimer = null; }
  }

  /* ---------------- Unified AI Insights command center ---------------- */
  /* Prominent AI analysis (left) that reads the live watch floor (right rail),
     with operational readiness in the header. Replaces the separate modals. */
  var lastFocus = null;

  function renderBriefHeader(r) {
    var host = el("#brief-readiness");
    if (!host) return;
    var lv = LEVELS[r.level];
    host.style.setProperty("--rl-c", lv.color);
    host.innerHTML =
      '<div class="bp-k">Operational Readiness</div>' +
      '<div class="bp-v">LEVEL ' + r.level + "</div>" +
      '<div class="bp-name">' + lv.name + "</div>";
  }

  function moveFor(dept, name) {
    if (dept === "police") return "Push an investigation cell to " + name + " and clear the FIR backlog.";
    if (dept === "health") return "Pre-position bed capacity and 108 units around " + name + ".";
    if (dept === "pds") return "Audit fair-price shops in " + name + " and stand up a grievance desk.";
    return "Surge review to " + name + ".";
  }

  function renderAIBrief(feeds, lineage) {
    var host = el("#ai-brief");
    if (!host) return;
    var r = readinessScore(feeds);
    var fusion = computeFusion(feeds);
    var top3 = fusion.list.slice(0, 3);
    var multi = fusion.list.filter(function (d) { return d.red >= 2; });
    var leaders = feeds.map(function (f) {
      var t = (f.districts || []).find(function (d) { return d.is_top; }) ||
        (f.districts || []).slice().sort(function (a, b) { return b.primary_value - a.primary_value; })[0];
      return { label: DEPT_META[f.department].label, name: t ? t.name : "—", value: t ? t.display_value : "—" };
    });
    var degraded = [];
    DEPTS.forEach(function (dept) {
      var data = lineage[dept];
      if (!data) return;
      var nodes = (data.sources || []).slice();
      if (data.ingestion) nodes.push(data.ingestion);
      nodes.forEach(function (n) {
        if (n.status && n.status !== "live") {
          degraded.push({ dept: dept, name: n.name, status: n.status, latency: n.latency_ms, sync: n.last_sync_seconds });
        }
      });
    });

    var headline = multi.length
      ? (multi.length + (multi.length > 1 ? " districts are" : " district is") + " under pressure on multiple fronts.")
      : "Risk is siloed tonight — nothing is critical across departments at once.";
    var sub = "Statewide posture is " + LEVELS[r.level].name + " (Level " + r.level + "). " +
      r.red + " critical and " + r.amber + " watch signals are live across Police, Health and PDS.";

    var focusHtml = top3.map(function (d) {
      var wd = DEPT_META[d.worst] || DEPT_META.police;
      var wval = (d.depts.find(function (x) { return x.id === d.worst; }) || {}).value || "";
      var reason = d.red >= 2 ? ("Critical in " + d.red + " departments — the broadest exposure on the board.")
        : d.red === 1 ? (wd.label + " critical" + (d.amber ? (" with " + d.amber + " more on watch.") : "."))
          : "Heaviest combined load in its cluster.";
      return '<a class="brief-focus" href="/district/' + encodeURIComponent(d.code) + "/?dept=" + d.worst +
        '" style="--fc:' + wd.color + '">' +
        '<div class="bf-dept">' + esc(wd.label) + "</div>" +
        '<div class="bf-name">' + esc(d.name) + "</div>" +
        '<div class="bf-val mono">' + esc(wval) + "</div>" +
        '<div class="bf-reason">' + esc(reason) + "</div></a>";
    }).join("");

    var points = [];
    points.push(multi.length
      ? esc(multi[0].name + " is red across " + multi[0].red + " departments — make it the main effort tonight.")
      : "Pressure is concentrated, not compounding — single-department response will hold.");
    points.push("Department leaders: " + esc(leaders.map(function (l) {
      return l.label + " → " + l.name + " (" + l.value + ")";
    }).join("; ")) + ".");
    points.push(degraded.length
      ? esc("Feed health: " + degraded.length + " of 18 sources degraded — " + degraded[0].name +
        " is " + degraded[0].status + " (" + degraded[0].latency + "ms, last " + syncAgo(degraded[0].sync) +
        "). Read " + DEPT_META[degraded[0].dept].label + " figures as a floor until it clears.")
      : "All source feeds are live — every figure here is real-time and clean.");
    points.push(esc(r.red + " critical signals active — operational tempo is " +
      (r.red >= 25 ? "high" : r.red >= 12 ? "elevated" : "steady") + "."));

    var movesHtml = top3.map(function (d) {
      var wd = DEPT_META[d.worst] || DEPT_META.police;
      return '<li><span class="bm-dept" style="color:' + wd.color + '">' + esc(wd.label) + "</span>" +
        esc(moveFor(d.worst, d.name)) + "</li>";
    }).join("");

    host.innerHTML =
      '<section class="brief-lead">' +
        '<div class="brief-k">Situation</div>' +
        '<div class="brief-headline">' + esc(headline) + "</div>" +
        '<div class="brief-sub">' + esc(sub) + "</div></section>" +
      '<section class="brief-block"><div class="brief-sec">Priority — act first</div>' +
        '<div class="brief-focus-grid">' + focusHtml + "</div></section>" +
      '<section class="brief-block"><div class="brief-sec">Signal read</div>' +
        '<ul class="brief-points">' + points.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul></section>" +
      '<section class="brief-block"><div class="brief-sec">Recommended moves</div>' +
        '<ul class="brief-moves">' + movesHtml + "</ul></section>";
  }

  function renderBriefAll() {
    if (state.feeds && state.feeds.length >= 3) {
      renderAIBrief(state.feeds, state.lineage || {});
    }
  }

  function openBrief() {
    var d = el("#aibrief");
    if (!d) return;
    lastFocus = document.activeElement;
    d.classList.remove("hidden");
    document.body.classList.add("aibrief-open");
    var close = el("[data-aibrief-close]");
    if (close) close.focus();
    if (!state.feeds) loadFeeds();
    if (!state.lineage) loadLineage(); // still feeds the feed-integrity insight line
    renderBriefAll();
    window.setTimeout(renderBriefAll, 700);
  }
  function closeBrief() {
    var d = el("#aibrief");
    if (!d || d.classList.contains("hidden")) return;
    d.classList.add("hidden");
    document.body.classList.remove("aibrief-open");
    stopJournal();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function bindBrief() {
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-aibrief-trigger]")) { e.preventDefault(); openBrief(); return; }
      var d = el("#aibrief");
      if (e.target.closest("[data-aibrief-close]") || e.target === d) closeBrief();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeBrief();
    });
  }

  /* ---------------- M6 — Fusion map lens (cross-department risk) ---------------- */
  var fusionActive = false;
  var SVG_NS = "http://www.w3.org/2000/svg";

  function statusWeight(s) { return s === "red" ? 100 : s === "amber" ? 58 : 18; }

  function computeFusion(feeds) {
    var base = feeds[0]; // geometry source (all feeds share district geometry)
    var byCode = {};
    feeds.forEach(function (f) {
      (f.districts || []).forEach(function (d) {
        var e = byCode[d.code] || (byCode[d.code] = {
          code: d.code, name: d.name, svg_path: d.svg_path,
          score: 0, red: 0, amber: 0, depts: [],
        });
        e.score += statusWeight(d.status);
        if (d.status === "red") e.red++;
        else if (d.status === "amber") e.amber++;
        e.depts.push({ id: f.department, label: DEPT_META[f.department].label, status: d.status, value: d.display_value });
      });
    });
    var list = Object.keys(byCode).map(function (k) { return byCode[k]; });
    list.forEach(function (e) {
      e.tier = e.red >= 2 ? "red" : (e.red === 1 || e.amber >= 2) ? "amber" : "green";
      e.worst = (e.depts.slice().sort(function (a, b) {
        return statusWeight(b.status) - statusWeight(a.status);
      })[0] || {}).id || "police";
    });
    list.sort(function (a, b) {
      if (b.red !== a.red) return b.red - a.red;
      return b.score - a.score;
    });
    var counts = { green: 0, amber: 0, red: 0 };
    list.forEach(function (e) { counts[e.tier]++; });
    return { list: list, counts: counts, viewBox: base.view_box || "0 0 1000 1200" };
  }

  function paintFusionMap(fusion) {
    var svg = el("#tn-map");
    var tip = el("#map-tooltip");
    if (!svg) return;
    svg.setAttribute("viewBox", fusion.viewBox);
    svg.innerHTML = "";
    var topFusionPath = null;
    fusion.list.forEach(function (e) {
      var path = document.createElementNS(SVG_NS, "path");
      var color = STATUS[e.tier].color;
      path.setAttribute("d", e.svg_path);
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute("aria-label", e.name + ": fusion " + e.tier + ", " + e.red + " departments critical");
      path.classList.add("district", "status-" + e.tier);
      if (e === fusion.list[0]) { path.classList.add("is-top"); topFusionPath = path; }
      path.style.setProperty("--glow", color);
      var breakdown = e.depts.map(function (d) {
        return d.label + " " + STATUS[d.status].label + " · " + d.value;
      }).join("<br>");
      path.addEventListener("mouseenter", function (ev) {
        if (!tip) return;
        tip.innerHTML = '<div class="n">' + esc(e.name) + "</div>" +
          '<div class="m">' + breakdown + "</div>" +
          '<span class="badge ' + e.tier + '"><span class="bd"></span>' +
          (e.red >= 2 ? "Severe" : e.tier === "amber" ? "Elevated" : "Low") + "</span>";
        tip.classList.remove("hidden");
        posTip(ev, tip);
      });
      path.addEventListener("mousemove", function (ev) { posTip(ev, tip); });
      path.addEventListener("mouseleave", function () { if (tip) tip.classList.add("hidden"); });
      path.addEventListener("click", function () {
        window.location.href = "/district/" + encodeURIComponent(e.code) + "/?dept=" + e.worst;
      });
      svg.appendChild(path);
    });
    if (topFusionPath) svg.appendChild(topFusionPath);
  }

  function posTip(ev, tip) {
    var stage = el(".svg-stage");
    if (!stage || !tip) return;
    var r = stage.getBoundingClientRect();
    tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 190) + "px";
    tip.style.top = Math.max(12, ev.clientY - r.top + 14) + "px";
  }

  function renderFusionPanel(fusion) {
    var label = el("#map-metric-label");
    if (label) label.textContent = "Combined cross-department risk";
    var counts = el("#status-counts");
    if (counts) {
      counts.innerHTML = ["green", "amber", "red"].map(function (t) {
        var lbl = t === "red" ? "Severe" : t === "amber" ? "Elevated" : "Low";
        return '<span class="count-pill"><span style="color:' + STATUS[t].color + '">' +
          lbl + "</span> " + fusion.counts[t] + "</span>";
      }).join("");
    }
    var top = fusion.list[0];
    var tn = el("#top-district-name");
    var tv = el("#top-metric .bm-v");
    if (top && tn) tn.textContent = top.name;
    if (top && tv) tv.textContent = top.red + "/3 critical";
    var alist = el("#alert-list");
    if (alist) {
      alist.innerHTML = fusion.list.filter(function (e) { return e.tier !== "green"; })
        .slice(0, 12).map(function (e) {
          var sc = STATUS[e.tier].color;
          return '<button class="arow" type="button" onclick="window.location.href=\'/district/' +
            encodeURIComponent(e.code) + "/?dept=" + e.worst + '\'">' +
            '<span class="dot ' + e.tier + '" style="background:' + sc + '"></span>' +
            '<span class="an">' + esc(e.name) + "</span>" +
            '<span class="av mono">' + e.red + "♦ " + e.amber + "▲</span></button>";
        }).join("") ||
        '<div class="empty-ok">No multi-department risk right now.</div>';
    }
  }

  function swapLegend(toFusion) {
    var t = el(".legend .lg-t");
    if (t) t.textContent = toFusion ? "Fusion Risk" : "Status";
  }

  function enterFusion() {
    var doIt = function () {
      if (!state.feeds || state.feeds.length < 3) { loadFeeds(); window.setTimeout(enterFusion, 400); return; }
      fusionActive = true;
      document.querySelectorAll(".dept-tab").forEach(function (t) { t.classList.remove("active"); });
      var ft = el(".fusion-tab"); if (ft) ft.classList.add("active");
      var mw = el(".mapwrap"); if (mw) mw.classList.add("fusion-mode");
      var fusion = computeFusion(state.feeds);
      paintFusionMap(fusion);
      renderFusionPanel(fusion);
      swapLegend(true);
    };
    doIt();
  }

  function exitFusionVisual() {
    if (!fusionActive) return;
    fusionActive = false;
    var ft = el(".fusion-tab"); if (ft) ft.classList.remove("active");
    var mw = el(".mapwrap"); if (mw) mw.classList.remove("fusion-mode");
    swapLegend(false);
    // dashboard.js repaints the real map on the dept-tab click that triggered this.
  }

  function bindFusion() {
    var ft = el(".fusion-tab");
    if (ft) ft.addEventListener("click", function () { enterFusion(); });
    document.addEventListener("click", function (e) {
      if (e.target.closest(".dept-tab")) exitFusionVisual();
    });
  }

  /* ---------------- M7 — Time playback (radar-loop heat replay) ---------------- */
  var pbCache = {};
  var pbDept = null, pbSeries = null, pbDay = 13, pbTimer = null;

  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  function heat(t) {
    t = Math.max(0, Math.min(1, t));
    var g = [34, 211, 155], a = [245, 177, 42], r = [242, 58, 58], c;
    if (t < 0.5) { var k = t / 0.5; c = [lerp(g[0], a[0], k), lerp(g[1], a[1], k), lerp(g[2], a[2], k)]; }
    else { var k2 = (t - 0.5) / 0.5; c = [lerp(a[0], r[0], k2), lerp(a[1], r[1], k2), lerp(a[2], r[2], k2)]; }
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  }

  function currentDept() {
    var active = document.querySelector(".dept-tab.active");
    if (active && active.dataset.dept) return active.dataset.dept;
    return document.body.dataset.dept || "police";
  }
  function feedFor(dept) {
    return (state.feeds || []).find(function (f) { return f.department === dept; });
  }

  function ensureSeries(dept) {
    if (pbCache[dept]) return Promise.resolve(pbCache[dept]);
    var feed = feedFor(dept);
    if (!feed) return Promise.resolve(null);
    var codes = feed.districts.map(function (d) { return d.code; });
    return Promise.all(codes.map(function (code) {
      return fetchJson("/api/district/" + encodeURIComponent(code) + "/?department=" + dept)
        .then(function (d) { return { code: code, trend: (d.trend || []).map(function (p) { return p.value; }) }; })
        .catch(function () { return { code: code, trend: [] }; });
    })).then(function (rows) {
      var byCode = {};
      rows.forEach(function (r) { byCode[r.code] = r.trend; });
      pbCache[dept] = byCode;
      return byCode;
    });
  }

  function paintHeat(dept, series, day) {
    var svg = el("#tn-map");
    var feed = feedFor(dept);
    if (!svg || !feed) return;
    var dayMax = 1;
    feed.districts.forEach(function (d) {
      var v = (series[d.code] || [])[day] || 0;
      if (v > dayMax) dayMax = v;
    });
    svg.innerHTML = "";
    feed.districts.forEach(function (d) {
      var v = (series[d.code] || [])[day] || 0;
      var t = v / dayMax;
      var color = heat(t);
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d.svg_path);
      path.classList.add("district");
      path.style.setProperty("--glow", color);
      path.style.fill = color;
      path.style.stroke = color;
      path.style.fillOpacity = String(0.26 + 0.62 * t);
      svg.appendChild(path);
    });
  }

  function pbSetDay(day) {
    pbDay = day;
    var label = el("#pb-day");
    if (label) label.textContent = day >= 13 ? "TODAY" : "D-" + (13 - day);
    var range = el("#pb-range");
    if (range && Number(range.value) !== day) range.value = day;
    if (pbSeries) paintHeat(pbDept, pbSeries, day);
  }
  function pbStop() {
    if (pbTimer) { window.clearInterval(pbTimer); pbTimer = null; }
    var b = el("#pb-play"); if (b) b.textContent = "▶";
  }
  function pbPlay() {
    if (reduce) { pbSetDay(13); return; }
    pbStop();
    var b = el("#pb-play"); if (b) b.textContent = "❚❚";
    if (pbDay >= 13) pbSetDay(0);
    pbTimer = window.setInterval(function () {
      if (pbDay >= 13) { pbStop(); return; }
      pbSetDay(pbDay + 1);
    }, 620);
  }

  function openPlayback() {
    if (fusionActive) {
      fusionActive = false;
      var ft = el(".fusion-tab"); if (ft) ft.classList.remove("active");
      var mw = el(".mapwrap"); if (mw) mw.classList.remove("fusion-mode");
      swapLegend(false);
    }
    var pb = el("#playback");
    if (!pb) return;
    pb.classList.remove("hidden");
    var btn = el("[data-playback-trigger]"); if (btn) btn.classList.add("on");
    pbDept = currentDept();
    var label = el("#pb-day"); if (label) label.textContent = "LOADING…";
    var go = function () {
      ensureSeries(pbDept).then(function (series) {
        if (!series) return;
        pbSeries = series;
        pbSetDay(13);
        pbPlay();
      });
    };
    if (!state.feeds || state.feeds.length < 3) { loadFeeds(); window.setTimeout(go, 600); } else go();
  }
  function closePlayback() {
    pbStop();
    var pb = el("#playback"); if (pb) pb.classList.add("hidden");
    var btn = el("[data-playback-trigger]"); if (btn) btn.classList.remove("on");
    var dept = pbDept || currentDept();
    var tab = document.querySelector('.dept-tab[data-dept="' + dept + '"]');
    if (tab) tab.click(); // dashboard.js repaints the live map
  }

  function bindPlayback() {
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-playback-trigger]")) { e.preventDefault(); openPlayback(); return; }
      if (e.target.closest("#pb-close")) { closePlayback(); return; }
      if (e.target.closest("#pb-play")) { if (pbTimer) pbStop(); else pbPlay(); return; }
    });
    var range = el("#pb-range");
    if (range) range.addEventListener("input", function () { pbStop(); pbSetDay(Number(range.value)); });
  }

  /* ---------------- Data load + wiring ---------------- */
  function applyFeeds(feeds) {
    if (!feeds || !feeds.length) return;
    state.feeds = feeds;
    renderReadiness(feeds);
    renderCrawl(feeds);
    if (state.lineage) {
      journalPool = buildJournalPool(feeds, state.lineage);
      seedJournal();
    }
    window.GridData = window.GridData || {};
    window.GridData.feeds = feeds;
  }

  function loadLineage() {
    Promise.all(DEPTS.map(function (d) {
      return fetchJson("/api/lineage/?department=" + d).catch(function () { return null; });
    })).then(function (list) {
      var byDept = {};
      DEPTS.forEach(function (d, i) { byDept[d] = list[i]; });
      state.lineage = byDept;
      renderFeedBoard(byDept);
      if (state.feeds) { journalPool = buildJournalPool(state.feeds, byDept); seedJournal(); }
      window.GridData = window.GridData || {};
      window.GridData.lineage = byDept;
    });
  }

  function loadFeeds() {
    Promise.all(DEPTS.map(function (d) {
      return fetchJson("/api/map/?department=" + d).catch(function () { return null; });
    })).then(function (list) {
      applyFeeds(list.filter(Boolean));
    });
  }

  function init() {
    if (!el("#readiness") && !el("#aibrief")) return; // not authenticated
    bindBrief();
    bindFusion();
    bindPlayback();

    var gotEvent = false;
    document.addEventListener("grid:feeds", function (e) {
      if (e.detail && e.detail.feeds) { gotEvent = true; applyFeeds(e.detail.feeds); }
    });

    // On the status home, dashboard.js will emit grid:feeds quickly — reuse it.
    // Elsewhere (or if it never fires), self-fetch.
    var onStatus = document.body.dataset.view === "status";
    if (onStatus) {
      window.setTimeout(function () { if (!gotEvent) loadFeeds(); }, 1500);
    } else {
      loadFeeds();
    }
    loadLineage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
