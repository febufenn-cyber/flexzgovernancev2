/* command-palette.js — Palantir Gotham-style global search (Ctrl/Cmd+K).
   Fuzzy-jump to any district + department switches + quick actions.
   Client-only; lazy-builds its index from /api/map (x3) on first open. */
(function () {
  "use strict";

  var DEPT_META = {
    police: { label: "Police", color: "#f5c542" },
    health: { label: "Health", color: "#f26da8" },
    pds: { label: "PDS", color: "#38bdf8" },
  };
  // Authorization layer (client mirror): scope index + actions to allowed depts.
  var DEPTS = (document.body.dataset.allowedDepts || "police,health,pds")
    .split(",").map(function (d) { return d.trim(); })
    .filter(function (d) { return DEPT_META[d]; });
  var STATUS = {
    green: { label: "Normal", color: "#22d39b", rank: 0 },
    amber: { label: "Watch", color: "#f5b12a", rank: 1 },
    red: { label: "Critical", color: "#f23a3a", rank: 2 },
  };

  function el(s, r) { return (r || document).querySelector(s); }
  function esc(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status); return r.json();
    });
  }

  var index = null;       // array of entries
  var loading = false;
  var results = [];       // current filtered
  var active = 0;
  var lastFocus = null;

  function actions() {
    var base = [
      { type: "action", label: "Open AI Insights", hint: "live brief + watch floor", icon: "⚡",
        run: function () { clickHook("[data-aibrief-trigger]"); } },
      { type: "action", label: "Open Data Lineage", hint: "where the numbers come from", icon: "🔗",
        run: function () { clickHook("[data-lineage-trigger]"); } },
    ];
    var deptActions = {
      police: { type: "dept", label: "Switch to Police", hint: "Law & Order", icon: "P", color: DEPT_META.police.color,
        run: function () { go("/?dept=police"); } },
      health: { type: "dept", label: "Switch to Health", hint: "Hospital Occupancy", icon: "H", color: DEPT_META.health.color,
        run: function () { go("/?dept=health"); } },
      pds: { type: "dept", label: "Switch to PDS", hint: "Public Distribution", icon: "D", color: DEPT_META.pds.color,
        run: function () { go("/?dept=pds"); } },
    };
    DEPTS.forEach(function (d) { if (deptActions[d]) base.push(deptActions[d]); });
    return base;
  }

  function clickHook(sel) {
    close();
    var t = el(sel);
    if (t) window.setTimeout(function () { t.click(); }, 120);
  }
  function go(href) { window.location.href = href; }

  function buildIndex(feeds) {
    var byCode = {};
    feeds.forEach(function (f) {
      (f.districts || []).forEach(function (d) {
        var e = byCode[d.code];
        if (!e) {
          e = byCode[d.code] = {
            type: "district", code: d.code, name: d.name,
            worst: d.status, dept: f.department, value: d.display_value,
            metric: f.metric_label, breakdown: [],
          };
        }
        e.breakdown.push({ dept: f.department, status: d.status, value: d.display_value });
        if (STATUS[d.status].rank > STATUS[e.worst].rank) {
          e.worst = d.status; e.dept = f.department; e.value = d.display_value; e.metric = f.metric_label;
        }
      });
    });
    var districts = Object.keys(byCode).map(function (k) { return byCode[k]; });
    districts.sort(function (a, b) {
      if (STATUS[b.worst].rank !== STATUS[a.worst].rank) return STATUS[b.worst].rank - STATUS[a.worst].rank;
      return a.name.localeCompare(b.name);
    });
    index = actions().concat(districts);
  }

  function ensureIndex() {
    if (index || loading) return Promise.resolve();
    if (window.GridData && window.GridData.feeds) { buildIndex(window.GridData.feeds); return Promise.resolve(); }
    loading = true;
    return Promise.all(DEPTS.map(function (d) {
      return fetchJson("/api/map/?department=" + d).catch(function () { return null; });
    })).then(function (list) {
      buildIndex(list.filter(Boolean));
      loading = false;
    }).catch(function () { loading = false; index = actions(); });
  }

  function filter(q) {
    q = (q || "").trim().toLowerCase();
    if (!index) return [];
    if (!q) {
      // default: actions + top critical districts
      var acts = index.filter(function (e) { return e.type !== "district"; });
      var crit = index.filter(function (e) { return e.type === "district"; }).slice(0, 8);
      return acts.concat(crit).slice(0, 12);
    }
    return index.filter(function (e) {
      return e.label ? e.label.toLowerCase().indexOf(q) >= 0
        : e.name.toLowerCase().indexOf(q) >= 0;
    }).slice(0, 12);
  }

  function rowHtml(e, i) {
    var on = i === active ? " is-active" : "";
    if (e.type === "district") {
      var sc = STATUS[e.worst].color;
      return '<button class="cmdk-row' + on + '" data-i="' + i + '" role="option">' +
        '<span class="cmdk-dot" style="background:' + sc + ';box-shadow:0 0 8px ' + sc + '"></span>' +
        '<span class="cmdk-label">' + esc(e.name) + "</span>" +
        '<span class="cmdk-hint">' + esc(DEPT_META[e.dept].label) + " " + esc(STATUS[e.worst].label) +
        " · " + esc(e.value) + "</span>" +
        '<span class="cmdk-kind">DISTRICT</span></button>';
    }
    var ic = e.color
      ? '<span class="cmdk-ic" style="color:' + e.color + ';border-color:' + e.color + '44">' + esc(e.icon) + "</span>"
      : '<span class="cmdk-ic">' + esc(e.icon) + "</span>";
    return '<button class="cmdk-row' + on + '" data-i="' + i + '" role="option">' + ic +
      '<span class="cmdk-label">' + esc(e.label) + "</span>" +
      '<span class="cmdk-hint">' + esc(e.hint || "") + "</span>" +
      '<span class="cmdk-kind">' + (e.type === "dept" ? "LENS" : "ACTION") + "</span></button>";
  }

  function render() {
    var box = el("#cmdk-results");
    if (!box) return;
    if (!index) { box.innerHTML = '<div class="cmdk-empty">Indexing the grid…</div>'; return; }
    if (!results.length) { box.innerHTML = '<div class="cmdk-empty">No matches.</div>'; return; }
    box.innerHTML = results.map(rowHtml).join("");
    var act = el(".cmdk-row.is-active", box);
    if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest" });
  }

  function run(e) {
    if (!e) return;
    if (e.type === "district") { go("/district/" + encodeURIComponent(e.code) + "/?dept=" + e.dept); return; }
    if (typeof e.run === "function") e.run();
  }

  function refresh() {
    var input = el("#cmdk-input");
    results = filter(input ? input.value : "");
    active = 0;
    render();
  }

  function open() {
    var modal = el("#cmdk");
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.classList.remove("hidden");
    document.body.classList.add("cmdk-open");
    var input = el("#cmdk-input");
    if (input) { input.value = ""; input.focus(); }
    ensureIndex().then(refresh);
    refresh();
  }
  function close() {
    var modal = el("#cmdk");
    if (!modal || modal.classList.contains("hidden")) return;
    modal.classList.add("hidden");
    document.body.classList.remove("cmdk-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function bind() {
    if (!el("#cmdk")) return; // not authenticated

    document.addEventListener("keydown", function (e) {
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        var modal = el("#cmdk");
        if (modal && modal.classList.contains("hidden")) open(); else close();
        return;
      }
      var modal = el("#cmdk");
      if (!modal || modal.classList.contains("hidden")) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, results.length - 1); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === "Enter") { e.preventDefault(); run(results[active]); }
    });

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-command-trigger]")) { e.preventDefault(); open(); return; }
      var modal = el("#cmdk");
      if (e.target === modal) { close(); return; }
      var row = e.target.closest(".cmdk-row");
      if (row) run(results[Number(row.dataset.i)]);
    });

    var input = el("#cmdk-input");
    if (input) input.addEventListener("input", refresh);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
