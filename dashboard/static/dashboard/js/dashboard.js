const DEPARTMENT_META = {
  police: { label: "Police", sub: "Law & Order", color: "#f5c542", initial: "P" },
  health: { label: "Health", sub: "Hospital Occupancy", color: "#f26da8", initial: "H" },
  pds: { label: "PDS", sub: "Public Distribution", color: "#38bdf8", initial: "D" },
};

const STATUS_META = {
  green: { label: "Normal", color: "#22d39b" },
  amber: { label: "Watch", color: "#f5b12a" },
  red: { label: "Critical", color: "#f23a3a" },
};

// Authorization layer (client mirror): the server already clamps every API
// call, but iterating the allowed list keeps the UI from requesting — and
// hard-failing on — departments this role cannot read.
const ALLOWED_DEPTS = (document.body.dataset.allowedDepts || "police,health,pds")
  .split(",")
  .map((d) => d.trim())
  .filter((d) => DEPARTMENT_META[d]);
const HOME_DISTRICT = document.body.dataset.homeDistrict || "";

let activeDept = document.body.dataset.dept || "police";
let detailChart = null;     // ECharts instance for the trend chart
let mapChart = null;        // ECharts instance for the GEO choropleth
let mapGeoRegistered = false;
let lastMapData = null;     // cached /api/map payload for theme re-render
let lastLineageFocus = null;
let lastInsightsFocus = null;

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function compactIndian(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value || "-";
  if (Math.abs(number) >= 10000000) return `${(number / 10000000).toFixed(2)} Cr`;
  if (Math.abs(number) >= 100000) return `${(number / 100000).toFixed(1)} L`;
  return new Intl.NumberFormat("en-IN").format(number);
}

function setActiveTabs(department) {
  qsa(".dept-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.dept === department);
  });
}

function summaryModeFromUrl() {
  return new URLSearchParams(window.location.search).get("summary") === "department"
    ? "department"
    : "ai";
}

function syncDeptQuery(department, summaryMode = summaryModeFromUrl()) {
  const url = new URL(window.location.href);
  url.searchParams.set("dept", department);
  if (summaryMode === "department") {
    url.searchParams.set("summary", "department");
  } else {
    url.searchParams.delete("summary");
  }
  window.history.replaceState({}, "", url);
}

function departmentParams(department = activeDept) {
  const params = new URLSearchParams({ dept: department });
  if (summaryModeFromUrl() === "department") {
    params.set("summary", "department");
  }
  return params.toString();
}

function districtHref(code, department = activeDept) {
  return `/district/${encodeURIComponent(code)}/?${departmentParams(department)}`;
}

function areaHref(code, department = activeDept) {
  return `/area/${encodeURIComponent(code)}/?${departmentParams(department)}`;
}

function homeHref(department = activeDept) {
  return `/?${departmentParams(department)}`;
}

function updateClock() {
  const timeNode = qs("#ist-clock");
  const dateNode = qs("#ist-date");
  if (!timeNode || !dateNode) return;

  const now = new Date();
  timeNode.textContent = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  dateNode.textContent = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);
}

async function fetchJson(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function renderBadge(status) {
  const meta = STATUS_META[status] || STATUS_META.green;
  return `<span class="badge ${status}"><span class="bd"></span>${meta.label}</span>`;
}

function lineageStatusMeta(status) {
  const meta = {
    live: { label: "Live", color: "#38bdf8" },
    delayed: { label: "Delayed", color: STATUS_META.amber.color },
    offline: { label: "Offline", color: STATUS_META.red.color },
  };
  return meta[status] || meta.live;
}

function lineageEdgeStatus(fromNode, toNode) {
  if (fromNode?.status === "offline" || toNode?.status === "offline") return "offline";
  if (fromNode?.status === "delayed" || toNode?.status === "delayed") return "delayed";
  return "live";
}

function syncAgo(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "unknown";
  if (value < 60) return `${value}s ago`;
  if (value < 3600) return `${Math.round(value / 60)}m ago`;
  return `${Math.round(value / 3600)}h ago`;
}

function renderSummaryCards(summary) {
  const container = qs("#summary-cards");
  if (!container) return;
  container.innerHTML = summary.cards
    .map((card) => {
      const tone = card.tone ? ` tone-${card.tone}` : "";
      return `
        <article class="card${tone}">
          <div class="card-top">
            <div class="k">${escapeHtml(card.key)}</div>
            <button class="source-info" type="button" data-lineage-trigger aria-label="Show data sources for ${escapeHtml(card.key)}">ⓘ</button>
          </div>
          <div class="v">${escapeHtml(card.value)}<span class="u">${escapeHtml(card.unit || "")}</span></div>
        </article>
      `;
    })
    .join("");
}

function renderHomeInsightLoading() {
  const container = qs("#summary-cards");
  if (!container) return;
  container.innerHTML = `
    <article class="card ai-summary-card loading">
      <div class="ai-card-label">AI Critical Insights</div>
      <div class="ai-card-title">Scanning live feeds</div>
      <div class="ai-card-copy">Checking Police, Health, and PDS district signals.</div>
    </article>
  `;
}

function buildHomeInsightCards(feeds) {
  const insights = buildInsights(feeds);
  const departmentCards = feeds.map((feed) => {
    const meta = DEPARTMENT_META[feed.department];
    const critical = [...feed.districts]
      .filter((district) => district.status === "red")
      .sort((a, b) => b.primary_value - a.primary_value);
    const lead = critical[0] || topDistrictForDepartment(feed);
    const counts = feed.summary.counts;

    return {
      label: `${meta.label} Critical`,
      title: lead.name,
      copy: `${lead.display_value} ${feed.metric_label.toLowerCase()}; ${counts.red} critical and ${counts.amber} watch districts statewide.`,
      color: meta.color,
      status: lead.status,
      department: feed.department,
      code: lead.code,
    };
  });

  return [
    {
      label: "Statewide AI Priority",
      title: "Top 3 Attention",
      copy: `Top districts needing attention: ${formatDistrictList(insights.topFocus.map((district) => district.name))}.`,
      color: "#22d39b",
      status: "red",
      department: insights.topFocus[0]?.department?.toLowerCase() || "police",
      code: insights.topFocus[0]?.code || "",
    },
    ...departmentCards,
  ].slice(0, 4);
}

function renderHomeInsightCards(feeds) {
  const container = qs("#summary-cards");
  if (!container) return;
  const cards = buildHomeInsightCards(feeds);
  container.innerHTML = cards
    .map((card) => {
      const status = STATUS_META[card.status] || STATUS_META.green;
      return `
        <button class="card ai-summary-card" type="button" data-dept="${escapeHtml(card.department)}" data-code="${escapeHtml(card.code)}" style="--ai-c:${card.color};--status-c:${status.color}">
          <div class="ai-card-top">
            <span class="ai-card-label">${escapeHtml(card.label)}</span>
            <span class="ai-card-status">${escapeHtml(status.label)}</span>
          </div>
          <div class="ai-card-title">${escapeHtml(card.title)}</div>
          <div class="ai-card-copy">${escapeHtml(card.copy)}</div>
        </button>
      `;
    })
    .join("");

  qsa(".ai-summary-card[data-code]", container).forEach((card) => {
    card.addEventListener("click", () => {
      if (!card.dataset.code) return;
      window.location.href = districtHref(card.dataset.code, card.dataset.dept || activeDept);
    });
  });
}

function renderStatusCounts(counts) {
  const container = qs("#status-counts");
  if (!container) return;
  container.innerHTML = ["green", "amber", "red"]
    .map((status) => {
      const meta = STATUS_META[status];
      return `<span class="count-pill"><span style="color:${meta.color}">${meta.label}</span> ${counts[status] || 0}</span>`;
    })
    .join("");
}

function positionTooltip(event, tooltip) {
  const stage = qs(".svg-stage");
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const nextX = event.clientX - rect.left + 14;
  const nextY = event.clientY - rect.top + 14;
  tooltip.style.left = `${Math.min(nextX, rect.width - 190)}px`;
  tooltip.style.top = `${Math.max(12, nextY)}px`;
}

// Read live CSS tokens so charts follow the LIGHT/DARK theme. theme.js only
// flips html[data-theme]; it dispatches no event, so we read computed styles
// on demand and bind our own listener to #theme-toggle (see initEchartsTheme).
function themeTokens() {
  const cs = getComputedStyle(document.documentElement);
  const t = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return {
    text: t("--text", "#e6eaf2"),
    muted: t("--muted", "#8d9aaf"),
    line: t("--line", "rgba(125,145,180,.16)"),
    panel: t("--panel", "rgba(18,28,50,.92)"),
    green: t("--green", STATUS_META.green.color),
    amber: t("--amber", STATUS_META.amber.color),
    red: t("--red", STATUS_META.red.color),
    gold: t("--gold", "#f2b807"),
  };
}

function statusColor(status, tk = themeTokens()) {
  if (status === "red") return tk.red;
  if (status === "amber") return tk.amber;
  return tk.green;
}

// Re-skin existing chart + map when the theme toggles (no full data refetch).
function initEchartsTheme() {
  const btn = qs("#theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    // theme.js flips data-theme synchronously on the same click; defer one frame
    // so getComputedStyle reads the NEW theme's tokens.
    requestAnimationFrame(() => {
      if (detailChart && window.__trendData) renderTrend(window.__trendData);
      if (mapChart && lastMapData) applyMapOption(lastMapData);
    });
  });
  window.addEventListener("resize", () => {
    if (detailChart) detailChart.resize();
    if (mapChart) mapChart.resize();
  });
}

// ECharts GEO choropleth. Paints onto the #tn-geo-map overlay div; the shared
// #tn-map SVG stays in the DOM (fusion-center + login-intro reference it).
function ensureGeoRegistered() {
  if (mapGeoRegistered) return Promise.resolve(true);
  return fetch("/static/dashboard/vendor/geo/tn_districts.geojson", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((geojson) => {
      echarts.registerMap("tn-districts", geojson);
      mapGeoRegistered = true;
      return true;
    });
}

function applyMapOption(data) {
  if (!mapChart) return;
  const tk = themeTokens();
  const seriesData = data.districts.map((d) => {
    const isTop = !!d.is_top;
    return {
      name: d.code,               // nameProperty:'code' matches feature.properties.code
      value: d.primary_value,
      _district: d,
      itemStyle: {
        areaColor: statusColor(d.status, tk),
        borderColor: isTop ? tk.gold : tk.line,
        borderWidth: isTop ? 2.4 : 0.6,
        shadowBlur: isTop ? 14 : 0,
        shadowColor: isTop ? tk.gold : "transparent",
      },
    };
  });

  mapChart.setOption({
    tooltip: {
      trigger: "item",
      backgroundColor: tk.panel,
      borderColor: tk.line,
      textStyle: { color: tk.text, fontFamily: "Public Sans, system-ui, sans-serif" },
      formatter: (params) => {
        const d = params.data && params.data._district;
        if (!d) return "";
        const meta = STATUS_META[d.status] || STATUS_META.green;
        return `<div style="font-weight:600">${escapeHtml(d.name)}</div>` +
               `<div>${escapeHtml(data.metric_label)}: <b>${escapeHtml(d.display_value)}</b></div>` +
               `<div style="color:${meta.color}">● ${escapeHtml(meta.label)}</div>`;
      },
    },
    series: [{
      type: "map",
      map: "tn-districts",
      nameProperty: "code",
      roam: false,
      selectedMode: false,
      label: { show: false },
      itemStyle: { areaColor: tk.line, borderColor: tk.line, borderWidth: 0.6 },
      emphasis: {
        label: { show: false },
        itemStyle: { areaColor: undefined, borderColor: tk.text, borderWidth: 1.4 },
      },
      data: seriesData,
    }],
  }, { notMerge: true });
  mapChart.resize();
}

function renderMap(data) {
  // Reverted to the hand-rolled SVG choropleth: it fits the map stage better,
  // and the ECharts geo canvas overlay was sitting on top of the absolutely-
  // positioned department tabs, intercepting their clicks (so Police/Health/
  // PDS/Combined couldn't be switched). ECharts is retained for the trend chart
  // only; the geo overlay stays hidden.
  lastMapData = data;
  showGeoOverlay(false);
  renderMapSVG(data);
}

// Overlay visibility: fusion (Combined) + playback repaint the shared SVG and set
// NO map-targetable class, so we manage it here — fully inside dashboard.js,
// never editing fusion-center.js. Hidden on .fusion-tab / playback open; shown
// on .dept-tab clicks (closePlayback() fires a .dept-tab click, restoring it).
function showGeoOverlay(show) {
  const host = qs("#tn-geo-map");
  if (!host) return;
  host.classList.toggle("geo-hidden", !show);
  if (show && mapChart) mapChart.resize();
}

function bindMapOverlayVisibility() {
  document.addEventListener("click", (event) => {
    if (event.target.closest(".dept-tab")) showGeoOverlay(true);
    if (event.target.closest(".fusion-tab") || event.target.closest("[data-playback-trigger]")) {
      showGeoOverlay(false);
    }
  });
}

function renderMapSVG(data) {
  const svg = qs("#tn-map");
  const tooltip = qs("#map-tooltip");
  if (!svg) return;
  svg.setAttribute("viewBox", data.view_box || "0 0 1000 1200");
  svg.innerHTML = "";

  const namespace = "http://www.w3.org/2000/svg";
  let topPath = null;
  data.districts.forEach((district) => {
    const path = document.createElementNS(namespace, "path");
    const statusMeta = STATUS_META[district.status] || STATUS_META.green;
    path.setAttribute("d", district.svg_path);
    path.setAttribute("tabindex", "0");
    path.setAttribute("role", "button");
    path.setAttribute("aria-label", `${district.name}: ${district.display_value}, ${statusMeta.label}`);
    path.classList.add("district", `status-${district.status}`);
    if (district.is_top) { path.classList.add("is-top"); topPath = path; }
    if (HOME_DISTRICT && district.code === HOME_DISTRICT) path.classList.add("is-home");
    path.style.setProperty("--glow", statusMeta.color);

    const title = document.createElementNS(namespace, "title");
    title.textContent = `${district.name} - ${district.display_value} - ${statusMeta.label}`;
    path.appendChild(title);

    path.addEventListener("mouseenter", (event) => {
      tooltip.innerHTML = `
        <div class="n">${escapeHtml(district.name)}</div>
        <div class="m">${escapeHtml(data.metric_label)}: <b>${escapeHtml(district.display_value)}</b></div>
        ${renderBadge(district.status)}
      `;
      tooltip.classList.remove("hidden");
      positionTooltip(event, tooltip);
    });
    path.addEventListener("mousemove", (event) => positionTooltip(event, tooltip));
    path.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
    path.addEventListener("click", () => {
      window.location.href = districtHref(district.code);
    });
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        window.location.href = districtHref(district.code);
      }
    });
    svg.appendChild(path);
  });

  // Paint the priority district last so its accent border isn't overlapped by neighbours.
  if (topPath) svg.appendChild(topPath);
  // (Radar-ping beacon removed for the government build — a static accent outline marks
  //  the priority district instead. See FLEXZ_UPGRADE.md §2.)
}

function renderStatusPanel(data) {
  const top = data.districts.find((district) => district.is_top);
  const topName = qs("#top-district-name");
  const topMetric = qs("#top-metric .bm-v");
  const topLabel = qs("#top-metric-label");
  const topBadge = qs("#top-badge");
  const alertList = qs("#alert-list");
  if (topName && top) topName.textContent = top.name;
  // Show the governance metric the priority is ranked on (pendency % / occupancy %
  // / complaints per 100k), not the raw headline count.
  if (topMetric && top) {
    const unit = (top.status_unit || "").trim();
    topMetric.textContent = top.status_value != null ? `${top.status_value}${unit}` : top.display_value;
  }
  if (topLabel && data.status_metric_label) topLabel.textContent = data.status_metric_label;
  if (topBadge && top) {
    const meta = STATUS_META[top.status] || STATUS_META.green;
    topBadge.className = `badge ${top.status}`;
    topBadge.innerHTML = `<span class="bd"></span>${meta.label}`;
  }
  if (!alertList) return;

  const alerts = data.districts
    .filter((district) => district.status === "red" || district.status === "amber")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "red" ? -1 : 1;
      return b.primary_value - a.primary_value;
    })
    .slice(0, 12);

  if (!alerts.length) {
    alertList.innerHTML = `<div class="empty-ok">No critical or watch districts for this department.</div>`;
    return;
  }

  alertList.innerHTML = alerts
    .map((district) => `
      <button class="arow" type="button" data-code="${escapeHtml(district.code)}" style="--row-c:${STATUS_META[district.status].color}">
        <span class="dot ${district.status}"></span>
        <span class="an">${escapeHtml(district.name)}</span>
        <span class="av mono">${escapeHtml(district.display_value)}</span>
      </button>
    `)
    .join("");

  qsa(".arow", alertList).forEach((row) => {
    row.addEventListener("click", () => {
      window.location.href = districtHref(row.dataset.code);
    });
  });
}

async function loadStatus(department, options = {}) {
  const showDepartmentCards = options.showDepartmentCards === true;
  activeDept = department;
  setActiveTabs(activeDept);
  syncDeptQuery(activeDept, showDepartmentCards ? "department" : "ai");
  const data = await fetchJson(`/api/map/?department=${activeDept}`);
  activeDept = data.department;
  qs("#map-metric-label").textContent = data.metric_label;
  if (showDepartmentCards) {
    renderSummaryCards(data.summary);
  } else {
    renderHomeInsightLoading();
    // Only fetch departments this role is allowed to read (avoids a 403 that
    // would reject the whole Promise.all and blank the home page for ministers).
    const feeds = await Promise.all(
      ALLOWED_DEPTS.map((dept) => (
        dept === data.department ? Promise.resolve(data) : fetchJson(`/api/map/?department=${dept}`)
      ))
    );
    renderHomeInsightCards(feeds);
    document.dispatchEvent(new CustomEvent("grid:feeds", { detail: { feeds, activeDept } }));
  }
  renderStatusCounts(data.summary.counts);
  renderMap(data);
  renderStatusPanel(data);
}

function fmtDelta(tile) {
  const d = Number(tile.delta_vs_target);
  if (!Number.isFinite(d)) return "";
  // For "higher_worse" metrics, above target (positive delta) is bad.
  const worse = tile.direction === "higher_worse" ? d > 0 : d < 0;
  const sign = d > 0 ? "+" : "";
  const cls = d === 0 ? "on-target" : worse ? "over" : "under";
  const u = (tile.status_unit || "").trim();
  return `<span class="tile-delta ${cls}">${sign}${d}${u} vs target</span>`;
}

function renderTiles(tiles) {
  const container = qs("#detail-tiles");
  if (!container) return;
  container.innerHTML = tiles
    .map((tile) => {
      const hasTarget = tile.target !== undefined && tile.target !== null;
      const u = (tile.status_unit || "").trim();
      const targetLine = hasTarget
        ? `<div class="tile-target">Target ${escapeHtml(String(tile.target))}${escapeHtml(u)}</div>${fmtDelta(tile)}`
        : "";
      return `
        <article class="tile${hasTarget ? " has-target" : ""}">
          <div class="tk">${escapeHtml(tile.key)}</div>
          <div class="tv">${escapeHtml(tile.value)}</div>
          ${targetLine}
        </article>
      `;
    })
    .join("");
}

function renderDepartmentRows(data) {
  const container = qs("#dept-overview");
  if (!container) return;
  container.innerHTML = data.all_departments
    .map((dept) => {
      const meta = DEPARTMENT_META[dept.id];
      const active = dept.id === data.department ? " on" : "";
      return `
        <button class="deptrow${active}" type="button" data-dept="${dept.id}" style="--dr-c:${meta.color}">
          <span class="ic">${meta.initial}</span>
          <span class="info">
            <span class="dl">${escapeHtml(dept.label)}</span>
            <span class="dm">${escapeHtml(dept.metric_label)}</span>
          </span>
          <span class="val">${escapeHtml(dept.display_value)}</span>
          ${renderBadge(dept.status)}
        </button>
      `;
    })
    .join("");

  qsa(".deptrow", container).forEach((row) => {
    row.addEventListener("click", () => loadDetail(row.dataset.dept));
  });
}

function trendDeltaPercent(trend) {
  if (!Array.isArray(trend) || trend.length < 2) return null;
  const previous = Number(trend[trend.length - 2]?.value);
  const current = Number(trend[trend.length - 1]?.value);
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function tileValue(tiles, key) {
  return (tiles || []).find((tile) => tile.key === key)?.value;
}

function buildDistrictAlerts(data) {
  const districtName = data.name || "this district";
  const departments = new Map((data.all_departments || []).map((dept) => [dept.id, dept]));
  const alerts = [];
  const activeMeta = DEPARTMENT_META[data.department] || { label: "Department", color: "var(--cyan)" };
  const activeDepartment = departments.get(data.department) || {
    id: data.department,
    label: activeMeta.label,
    metric_label: data.active.metric_label,
    display_value: data.active.display_value,
    status: data.active.status,
  };
  const delta = trendDeltaPercent(data.trend);

  if (delta !== null) {
    const movement = delta >= 0 ? "increased" : "reduced";
    const trendLabel = data.department === "police"
      ? "Crime signal"
      : `${activeMeta.label} signal`;
    alerts.push({
      department: data.department,
      status: delta >= 15 ? "red" : delta >= 5 ? "amber" : activeDepartment.status,
      meta: "Today vs yesterday",
      text: `${trendLabel} ${movement} ${Math.abs(delta)}% today in ${districtName}.`,
    });
  }

  if (data.department === "police") {
    const pending = tileValue(data.active.tiles, "FIR Pending");
    const disposed = tileValue(data.active.tiles, "Disposed");
    const pendency = tileValue(data.active.tiles, "Pendency");
    alerts.push({
      department: "police",
      status: activeDepartment.status,
      meta: activeDepartment.metric_label,
      text: `Police has ${pending || "live"} FIRs pending with ${activeDepartment.display_value} filed in ${districtName}.`,
    });
    if (disposed || pendency) {
      alerts.push({
        department: "police",
        status: activeDepartment.status,
        meta: "Case movement",
        text: `${disposed || "Current"} FIRs disposed; pendency is ${pendency || "under review"} in ${districtName}.`,
      });
    }
  } else if (data.department === "health") {
    const vacantBeds = tileValue(data.active.tiles, "Beds Vacant");
    const occupiedBeds = tileValue(data.active.tiles, "Beds Occupied");
    const sanctionedBeds = tileValue(data.active.tiles, "Sanctioned Beds");
    alerts.push({
      department: "health",
      status: activeDepartment.status,
      meta: activeDepartment.metric_label,
      text: `Health occupancy is ${activeDepartment.display_value}; ${vacantBeds || "current"} beds remain vacant in ${districtName}.`,
    });
    if (occupiedBeds || sanctionedBeds) {
      alerts.push({
        department: "health",
        status: activeDepartment.status,
        meta: "Hospital load",
        text: `${occupiedBeds || "Current"} of ${sanctionedBeds || "available"} sanctioned beds are occupied in ${districtName}.`,
      });
    }
  } else if (data.department === "pds") {
    const rationShops = tileValue(data.active.tiles, "Ration Shops");
    const rationUsers = tileValue(data.active.tiles, "Ration Users");
    const surge = tileValue(data.active.tiles, "Complaint Surge");
    alerts.push({
      department: "pds",
      status: activeDepartment.status,
      meta: activeDepartment.metric_label,
      text: `PDS has ${activeDepartment.display_value} complaints across ${rationShops || "active"} ration shops in ${districtName}.`,
    });
    if (rationUsers || surge) {
      alerts.push({
        department: "pds",
        status: activeDepartment.status,
        meta: "Complaint movement",
        text: `${rationUsers || "Active"} ration users monitored; complaint surge is ${surge || "under review"} in ${districtName}.`,
      });
    }
  }

  if (activeDepartment.status === "red" || activeDepartment.status === "amber") {
    const statusText = STATUS_META[activeDepartment.status]?.label || "Watch";
    alerts.push({
      department: data.department,
      status: activeDepartment.status,
      meta: `${activeDepartment.label} ${statusText}`,
      text: `${activeDepartment.label} is in ${statusText.toLowerCase()} status for ${activeDepartment.metric_label.toLowerCase()} in ${districtName}.`,
    });
  }

  if (!alerts.length) {
    alerts.push({
      department: data.department,
      status: "green",
      meta: "Live monitoring",
      text: `${activeMeta.label} signals are normal in ${districtName}.`,
    });
  }

  return alerts;
}

function renderDistrictAlerts(data) {
  const container = qs("#district-alert-feed");
  if (!container) return;

  const alerts = buildDistrictAlerts(data);
  const repeatedAlerts = [...alerts, ...alerts];
  container.innerHTML = `
    <div class="alert-track">
      ${repeatedAlerts.map((alert) => {
        const meta = DEPARTMENT_META[alert.department] || DEPARTMENT_META[data.department];
        const status = STATUS_META[alert.status] || STATUS_META.green;
        return `
          <article class="district-alert" style="--alert-c:${meta.color};--status-c:${status.color}">
            <span class="alert-dot ${alert.status}"></span>
            <span class="alert-copy">
              <span class="alert-meta">${escapeHtml(alert.meta)}</span>
              <span class="alert-text">${escapeHtml(alert.text)}</span>
            </span>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderTrend(data) {
  const elTrend = qs("#trend-chart");
  if (!elTrend || typeof echarts === "undefined") return;
  window.__trendData = data; // cached for theme re-render
  if (window.__trendLive) { clearInterval(window.__trendLive); window.__trendLive = null; }

  const tk = themeTokens();
  const color = statusColor(data.active.status, tk);
  const labels = data.trend.map((point) => (point.day === 13 ? "Today" : `D-${13 - point.day}`));
  const values = data.trend.map((point) => point.value);

  // Reuse the instance across re-renders; init once per element.
  detailChart = echarts.getInstanceByDom(elTrend) || echarts.init(elTrend, null, { renderer: "canvas" });

  detailChart.setOption({
    animationDuration: 420,
    grid: { left: 46, right: 14, top: 14, bottom: 26 },
    tooltip: {
      trigger: "axis",
      backgroundColor: tk.panel,
      borderColor: tk.line,
      textStyle: { color: tk.text, fontFamily: "Public Sans, system-ui, sans-serif" },
      formatter: (params) => {
        const p = params[0];
        return `${escapeHtml(p.axisValue)}<br/><b>${escapeHtml(compactIndian(p.data))}</b>`;
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: tk.line } },
      axisTick: { show: false },
      axisLabel: { color: tk.muted, fontFamily: "IBM Plex Mono, monospace", interval: "auto", hideOverlap: true },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: tk.line } },
      axisLabel: { color: tk.muted, fontFamily: "IBM Plex Mono, monospace", formatter: (v) => compactIndian(v) },
    },
    series: [{
      type: "line",
      data: values,
      smooth: 0.38,
      showSymbol: false,
      symbolSize: 8,
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color + "44" },
          { offset: 1, color: color + "05" },
        ]),
      },
    }],
  }, { notMerge: true });
  detailChart.resize();

  // Live "streaming sensor" breathe on the latest point (status-neutral ±0.6%).
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced && values.length) {
    const liveBase = values[values.length - 1];
    const live = values.slice();
    window.__trendLive = setInterval(() => {
      if (!detailChart || document.hidden) return;
      const drift = (Math.random() - 0.5) * 0.012;
      live[live.length - 1] = Math.max(1, Math.round(liveBase * (1 + drift)));
      detailChart.setOption({ series: [{ data: live }] });
    }, 1600);
  }
}

function renderAreas(data) {
  const grid = qs("#area-grid");
  if (!grid) return;
  if (!data.areas.length) {
    const departmentLabel = DEPARTMENT_META[data.department]?.label || "this department";
    grid.innerHTML = `<div class="empty-ok ward-empty">Ward cards are shown only for the top critical ${escapeHtml(departmentLabel)} district.</div>`;
    return;
  }
  grid.innerHTML = data.areas
    .map((area) => {
      const glow = STATUS_META[area.status]?.color || "#38bdf8";
      const topClass = area.is_top ? " is-top" : "";
      return `
        <button class="area-card${topClass}" type="button" data-code="${escapeHtml(area.code)}" style="--card-glow:${glow}">
          <div class="area-name">${escapeHtml(area.name)}</div>
          <div class="area-value">${escapeHtml(area.display_value)}</div>
          ${renderBadge(area.status)}
        </button>
      `;
    })
    .join("");

  qsa(".area-card", grid).forEach((card) => {
    card.addEventListener("click", () => {
      window.location.href = areaHref(card.dataset.code);
    });
  });
}

function renderDetail(data) {
  activeDept = data.department;
  setActiveTabs(activeDept);
  syncDeptQuery(activeDept);

  const view = document.body.dataset.view;
  const currentDept = data.all_departments.find((dept) => dept.id === activeDept);
  qs("#active-dept-label").textContent = currentDept?.label || DEPARTMENT_META[activeDept].label;
  qs("#active-metric-label").textContent = data.active.metric_label;
  qs("#primary-metric .bm-v").textContent = data.active.display_value;

  const statusBadge = qs("#active-status");
  statusBadge.className = `badge ${data.active.status}`;
  statusBadge.innerHTML = `<span class="bd"></span>${STATUS_META[data.active.status].label}`;

  qs("#trend-caption").textContent =
    data.active.status === "red" || data.is_top_area ? "Spiking" : "Live signal";

  if (view === "district") {
    qs("#detail-title").textContent = data.name;
    qs("#crumb-name").textContent = data.name;
    qs("#detail-back").href = homeHref(activeDept);
    qs("#state-back").href = homeHref(activeDept);
    renderAreas(data);
  } else if (view === "area") {
    qs("#detail-title").textContent = data.name;
    qs("#crumb-name").textContent = data.name;
    qs("#district-back").textContent = data.district.name;
    qs("#district-back").href = districtHref(data.district.code);
    qs("#detail-back").href = districtHref(data.district.code);
    qs("#state-back").href = homeHref(activeDept);
  }

  renderTiles(data.active.tiles);
  renderDepartmentRows(data);
  renderDistrictAlerts(data);
  renderTrend(data);
}

async function loadDetail(department) {
  activeDept = department;
  const view = document.body.dataset.view;
  const code = document.body.dataset.code;
  const data = await fetchJson(`/api/${view}/${encodeURIComponent(code)}/?department=${activeDept}`);
  renderDetail(data);
}

function bindTabs() {
  // Event delegation (one listener on document) instead of per-element binding —
  // robust to tab elements being (re)rendered or to init-order races, which was
  // leaving the Police/Health/PDS tabs unclickable on the home page.
  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".dept-tab");
    if (!tab || !tab.dataset.dept) return;
    const department = tab.dataset.dept;
    if (document.body.dataset.view === "status") {
      loadStatus(department, { showDepartmentCards: true }).catch(showLoadError);
    } else {
      loadDetail(department).catch(showLoadError);
    }
  });
}

function showLoadError(error) {
  console.error(error);
  const message = `<div class="empty-ok">Could not load dashboard data: ${escapeHtml(error.message)}</div>`;
  const alertList = qs("#alert-list");
  const tiles = qs("#detail-tiles");
  if (alertList) alertList.innerHTML = message;
  if (tiles) tiles.innerHTML = message;
}

function renderLineageNode(node, type, x, y, extraHtml = "") {
  const status = lineageStatusMeta(node.status);
  const tooltip = `${node.description} · latency ${node.latency_ms} ms`;
  return `
    <section
      class="lineage-node ${type} ${node.status}"
      style="left:${x}%;top:${y}%;--node-c:${status.color}"
      tabindex="0"
      data-lineage-tooltip="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(node.name)} ${status.label}"
    >
      <div class="node-head">
        <span class="node-icon" aria-hidden="true">${escapeHtml(node.icon)}</span>
        <span class="node-title">${escapeHtml(node.name)}</span>
        <span class="node-status"><span></span>${status.label}</span>
      </div>
      ${extraHtml || `
        <div class="node-meta">${escapeHtml(syncAgo(node.last_sync_seconds))}</div>
        <div class="node-records mono">${escapeHtml(compactIndian(node.records_today))} records today</div>
      `}
    </section>
  `;
}

function edgePath(from, to) {
  const mid = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`;
}

function renderEdge(edge, index) {
  const path = edgePath(edge.from, edge.to);
  const packetCount = edge.status === "delayed" ? 1 : 3;
  const duration = edge.status === "delayed" ? 8.5 : 3.2;
  const packets = edge.status === "offline"
    ? ""
    : Array.from({ length: packetCount })
      .map((_, packetIndex) => `
        <circle class="lineage-packet ${edge.status}" r="${edge.status === "delayed" ? ".55" : ".65"}">
          <animateMotion dur="${duration}s" repeatCount="indefinite" begin="-${(packetIndex * duration / packetCount).toFixed(2)}s" path="${path}" />
        </circle>
      `)
      .join("");

  return `
    <path class="lineage-edge ${edge.status}" d="${path}" pathLength="1" />
    ${packets}
  `;
}

function renderLineageMindmap(data, note = "") {
  const content = qs("#lineage-content");
  const title = qs("#lineage-title");
  const subtitle = qs("#lineage-subtitle");
  const noteNode = qs("#lineage-note");
  if (!content || !title || !subtitle || !noteNode) return;

  title.textContent = `Data Lineage - ${data.label || DEPARTMENT_META[data.department]?.label || data.department}`;
  subtitle.textContent = "where these numbers come from · live";
  noteNode.textContent = note;
  noteNode.classList.toggle("hidden", !note);

  const sourcePositions = [
    { x: 4, y: 5, anchor: { x: 32, y: 13 } },
    { x: 4, y: 28, anchor: { x: 32, y: 36 } },
    { x: 4, y: 51, anchor: { x: 32, y: 59 } },
    { x: 4, y: 74, anchor: { x: 32, y: 82 } },
  ];
  const ingestionPosition = { x: 40, y: 38, left: { x: 44, y: 50 }, right: { x: 60, y: 50 } };
  const kpiPosition = { x: 70, y: 34, left: { x: 72, y: 50 } };

  const edgeModels = [];
  data.sources.forEach((source, index) => {
    edgeModels.push({
      from: sourcePositions[index].anchor,
      to: ingestionPosition.left,
      status: lineageEdgeStatus(source, data.ingestion),
    });
  });
  edgeModels.push({
    from: ingestionPosition.right,
    to: kpiPosition.left,
    status: lineageEdgeStatus(data.ingestion, data.kpi),
  });

  const sourceNodes = data.sources
    .map((source, index) => renderLineageNode(source, "source", sourcePositions[index].x, sourcePositions[index].y))
    .join("");
  const ingestionNode = renderLineageNode(
    data.ingestion,
    "ingestion",
    ingestionPosition.x,
    ingestionPosition.y,
    `<div class="node-meta">ingestion + ETL</div><div class="node-records mono">${escapeHtml(compactIndian(data.ingestion.records_today))} records today</div>`
  );
  const kpiItems = (data.kpi.items || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const kpiNode = renderLineageNode(
    data.kpi,
    "hub",
    kpiPosition.x,
    kpiPosition.y,
    `<ul class="kpi-list">${kpiItems}</ul>`
  );

  content.innerHTML = `
    <div class="lineage-map">
      <div class="tier-label sources">Sources</div>
      <div class="tier-label ingestion">Ingestion</div>
      <div class="tier-label kpis">KPIs</div>
      <svg class="lineage-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        ${edgeModels.map(renderEdge).join("")}
      </svg>
      ${sourceNodes}
      ${ingestionNode}
      ${kpiNode}
    </div>
  `;
}

function setLineageLoading(note = "") {
  const content = qs("#lineage-content");
  const title = qs("#lineage-title");
  const subtitle = qs("#lineage-subtitle");
  const noteNode = qs("#lineage-note");
  if (title) title.textContent = `Data Lineage - ${DEPARTMENT_META[activeDept]?.label || "Department"}`;
  if (subtitle) subtitle.textContent = "where these numbers come from · live";
  if (noteNode) {
    noteNode.textContent = note;
    noteNode.classList.toggle("hidden", !note);
  }
  if (content) {
    content.innerHTML = `
      <div class="lineage-loading">
        <span></span>
        <b>Loading lineage graph</b>
      </div>
    `;
  }
}

function openLineageShell() {
  const modal = qs("#lineage-modal");
  if (!modal) return;
  lastLineageFocus = document.activeElement;
  modal.classList.remove("hidden");
  document.body.classList.add("lineage-open");
  qs("[data-lineage-close]", modal)?.focus();
}

function closeLineage() {
  const modal = qs("#lineage-modal");
  if (!modal || modal.classList.contains("hidden")) return;
  modal.classList.add("hidden");
  document.body.classList.remove("lineage-open");
  qs("#lineage-tip")?.classList.add("hidden");
  lastLineageFocus?.focus?.();
}

async function openLineage(note = "") {
  openLineageShell();
  setLineageLoading(note);
  const data = await fetchJson(`/api/lineage/?department=${activeDept}`);
  renderLineageMindmap(data, note);
}

function positionLineageTooltip(event, tooltip) {
  const panel = qs(".lineage-panel");
  if (!panel) return;
  const rect = panel.getBoundingClientRect();
  const x = event.clientX ? event.clientX - rect.left + 14 : 24;
  const y = event.clientY ? event.clientY - rect.top + 14 : 88;
  tooltip.style.left = `${Math.min(x, rect.width - 260)}px`;
  tooltip.style.top = `${Math.max(12, y)}px`;
}

function bindLineage() {
  const modal = qs("#lineage-modal");
  const content = qs("#lineage-content");
  const tooltip = qs("#lineage-tip");

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lineage-trigger]");
    if (trigger) {
      event.preventDefault();
      openLineage(trigger.dataset.lineageNote || "").catch((error) => {
        console.error(error);
        const lineageContent = qs("#lineage-content");
        if (lineageContent) {
          lineageContent.innerHTML = `<div class="empty-ok">Could not load data lineage: ${escapeHtml(error.message)}</div>`;
        }
      });
      return;
    }

    if (event.target.closest("[data-lineage-close]") || event.target === modal) {
      closeLineage();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLineage();
  });

  content?.addEventListener("mousemove", (event) => {
    const node = event.target.closest(".lineage-node");
    if (!node || !tooltip) return;
    tooltip.textContent = node.dataset.lineageTooltip || "";
    tooltip.classList.remove("hidden");
    positionLineageTooltip(event, tooltip);
  });

  content?.addEventListener("mouseleave", () => tooltip?.classList.add("hidden"));
  content?.addEventListener("focusin", (event) => {
    const node = event.target.closest(".lineage-node");
    if (!node || !tooltip) return;
    tooltip.textContent = node.dataset.lineageTooltip || "";
    tooltip.classList.remove("hidden");
    positionLineageTooltip(event, tooltip);
  });
  content?.addEventListener("focusout", () => tooltip?.classList.add("hidden"));
}

function statusRiskScore(status) {
  if (status === "red") return 100;
  if (status === "amber") return 58;
  return 18;
}

function formatDistrictList(names) {
  if (!names.length) return "No districts";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function topDistrictForDepartment(feed) {
  const topCode = feed.top_district;
  return feed.districts.find((district) => district.code === topCode)
    || [...feed.districts].sort((a, b) => b.primary_value - a.primary_value)[0];
}

function buildInsights(feeds) {
  const aggregate = new Map();
  const departmentFocus = feeds.map((feed) => {
    const meta = DEPARTMENT_META[feed.department];
    const sorted = [...feed.districts].sort((a, b) => b.primary_value - a.primary_value);
    sorted.forEach((district, index) => {
      const current = aggregate.get(district.code) || {
        code: district.code,
        name: district.name,
        score: 0,
        redCount: 0,
        amberCount: 0,
        departments: [],
      };
      const rankBoost = Math.max(0, 36 - index);
      current.score += statusRiskScore(district.status) + rankBoost;
      if (district.status === "red") current.redCount += 1;
      if (district.status === "amber") current.amberCount += 1;
      current.departments.push({
        department: feed.department,
        label: meta.label,
        metric: feed.metric_label,
        value: district.display_value,
        status: district.status,
        color: meta.color,
      });
      aggregate.set(district.code, current);
    });

    const top = topDistrictForDepartment(feed);
    return {
      department: feed.department,
      label: meta.label,
      color: meta.color,
      metric: feed.metric_label,
      top,
      counts: feed.summary.counts,
      next: sorted.find((district) => district.code !== top.code),
    };
  });

  const riskRank = [...aggregate.values()]
    .sort((a, b) => {
      if (b.redCount !== a.redCount) return b.redCount - a.redCount;
      return b.score - a.score;
    });
  const topCodes = new Set();
  const topFocus = [];

  departmentFocus.forEach((focus) => {
    if (!focus.top || topCodes.has(focus.top.code)) return;
    topCodes.add(focus.top.code);
    topFocus.push({
      code: focus.top.code,
      name: focus.top.name,
      departmentId: focus.department,
      department: focus.label,
      metric: focus.metric,
      value: focus.top.display_value,
      color: focus.color,
      reason: `Highest ${focus.metric.toLowerCase()} in ${focus.label}.`,
    });
  });

  riskRank.forEach((district) => {
    if (topFocus.length >= 3 || topCodes.has(district.code)) return;
    const lead = district.departments.find((dept) => dept.status === "red") || district.departments[0];
    topCodes.add(district.code);
    topFocus.push({
      code: district.code,
      name: district.name,
      departmentId: lead.department,
      department: lead.label,
      metric: lead.metric,
      value: lead.value,
      color: lead.color,
      reason: `${district.redCount} critical and ${district.amberCount} watch signals across departments.`,
    });
  });

  const multiCritical = riskRank.filter((district) => district.redCount >= 2).slice(0, 4);
  const allCritical = riskRank.filter((district) => district.redCount >= 3).slice(0, 3);
  const allCriticalNames = allCritical.map((district) => district.name);
  const multiCriticalNames = multiCritical.map((district) => district.name);
  const criticalCounts = departmentFocus
    .map((focus) => `${focus.label}: ${focus.counts.red} critical, ${focus.counts.amber} watch`)
    .join(" · ");

  const insightRows = [
    {
      label: "Top 3",
      text: `Top 3 districts needing your attention: ${formatDistrictList(topFocus.map((district) => district.name))}.`,
    },
    ...departmentFocus.map((focus) => ({
      label: focus.label,
      text: `${focus.top.name} leads ${focus.metric.toLowerCase()} at ${focus.top.display_value}${focus.next ? `, followed by ${focus.next.name} at ${focus.next.display_value}` : ""}.`,
    })),
    {
      label: "Overlap",
      text: allCriticalNames.length
        ? `${formatDistrictList(allCriticalNames)} ${allCriticalNames.length === 1 ? "is" : "are"} critical across Police, Health, and PDS.`
        : multiCriticalNames.length
          ? `${formatDistrictList(multiCriticalNames)} ${multiCriticalNames.length === 1 ? "shows" : "show"} critical pressure in multiple departments.`
          : "No district is critical across multiple departments right now.",
    },
    {
      label: "Breadth",
      text: `Statewide risk spread: ${criticalCounts}.`,
    },
  ];

  return { topFocus, insightRows };
}

function setInsightsLoading() {
  const content = qs("#insights-content");
  if (!content) return;
  content.innerHTML = `<div class="insights-loading">Analyzing live district feeds</div>`;
}

function renderInsights(feeds) {
  const content = qs("#insights-content");
  if (!content) return;
  const insights = buildInsights(feeds);
  content.innerHTML = `
    <div class="insights-brief">
      <section class="insight-lead">
        <div class="insight-k">Top 3 districts needing your attention</div>
        <div class="insight-topline">${escapeHtml(formatDistrictList(insights.topFocus.map((district) => district.name)))}</div>
      </section>
      <section class="insight-focus-grid">
        ${insights.topFocus.map((district) => `
          <a class="insight-focus" href="${districtHref(district.code, district.departmentId)}" data-code="${escapeHtml(district.code)}" data-dept="${escapeHtml(district.departmentId)}" style="--focus-c:${district.color}">
            <div class="dept">${escapeHtml(district.department)}</div>
            <div class="name">${escapeHtml(district.name)}</div>
            <div class="value">${escapeHtml(district.value)}</div>
            <div class="reason">${escapeHtml(district.reason)}</div>
          </a>
        `).join("")}
      </section>
      <section class="insight-list">
        ${insights.insightRows.map((row) => `
          <div class="insight-row">
            <b>${escapeHtml(row.label)}</b>
            <span>${escapeHtml(row.text)}</span>
          </div>
        `).join("")}
      </section>
    </div>
  `;

  qsa(".insight-focus[data-code]", content).forEach((card) => {
    card.addEventListener("click", () => {
      closeInsights();
      window.location.href = districtHref(card.dataset.code, card.dataset.dept || activeDept);
    });
  });
}

function openInsightsShell() {
  const modal = qs("#insights-modal");
  if (!modal) return;
  lastInsightsFocus = document.activeElement;
  modal.classList.remove("hidden");
  document.body.classList.add("insights-open");
  qs("[data-insights-close]", modal)?.focus();
}

function closeInsights() {
  const modal = qs("#insights-modal");
  if (!modal || modal.classList.contains("hidden")) return;
  modal.classList.add("hidden");
  document.body.classList.remove("insights-open");
  lastInsightsFocus?.focus?.();
}

async function openInsights() {
  openInsightsShell();
  setInsightsLoading();
  const feeds = await Promise.all(
    ALLOWED_DEPTS.map((department) => fetchJson(`/api/map/?department=${department}`))
  );
  renderInsights(feeds);
}

function bindInsights() {
  const modal = qs("#insights-modal");
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-insights-trigger]");
    if (trigger) {
      event.preventDefault();
      openInsights().catch((error) => {
        console.error(error);
        const content = qs("#insights-content");
        if (content) {
          content.innerHTML = `<div class="empty-ok">Could not load AI insights: ${escapeHtml(error.message)}</div>`;
        }
      });
      return;
    }

    if (event.target.closest("[data-insights-close]") || event.target === modal) {
      closeInsights();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeInsights();
  });
}

function initLoginReveal() {
  const page = qs(".login-page");
  const trigger = qs("#login-logo-trigger");
  const card = qs("#login-card");
  if (!page || !trigger || !card) return;

  const open = () => {
    page.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    card.removeAttribute("aria-hidden");
    card.removeAttribute("inert");
    window.setTimeout(() => {
      qs('input[name="username"]', card)?.focus();
    }, 720);
  };

  const username = qs('input[name="username"]', card);
  const role = qs('select[name="role"]', card);
  const suggestionBox = qs("#username-role-options", card);
  const options = qsa("#username-role-options button", card);
  const labelToRole = new Map(options.map((option) => [option.dataset.value.toLowerCase(), option.dataset.role]));
  const roleToLabel = new Map(options.map((option) => [option.dataset.role, option.dataset.value]));
  let activeSuggestionIndex = -1;

  const hideSuggestions = () => {
    if (!suggestionBox) return;
    suggestionBox.hidden = true;
    activeSuggestionIndex = -1;
    options.forEach((option) => option.classList.remove("is-active"));
    username?.setAttribute("aria-expanded", "false");
  };

  const visibleSuggestions = () => options.filter((option) => !option.hidden);

  const setActiveSuggestion = (index) => {
    const visible = visibleSuggestions();
    if (!visible.length) return;
    activeSuggestionIndex = (index + visible.length) % visible.length;
    options.forEach((option) => option.classList.remove("is-active"));
    visible[activeSuggestionIndex].classList.add("is-active");
  };

  const selectSuggestion = (option) => {
    if (!option || !username || !role) return;
    username.value = option.dataset.value;
    role.value = option.dataset.role;
    hideSuggestions();
    username.focus();
  };

  const updateSuggestions = () => {
    if (!username || !suggestionBox) return;
    const query = username.value.trim().toLowerCase();
    if (!query) {
      hideSuggestions();
      return;
    }

    let shown = 0;
    options.forEach((option) => {
      const match = option.dataset.value.toLowerCase().startsWith(query);
      option.hidden = !match;
      if (match) shown += 1;
    });

    suggestionBox.hidden = shown === 0;
    username.setAttribute("aria-expanded", shown > 0 ? "true" : "false");
    activeSuggestionIndex = -1;

    const selectedRole = labelToRole.get(username.value.trim().toLowerCase());
    if (selectedRole && role) {
      role.value = selectedRole;
    }
  };

  username?.addEventListener("input", updateSuggestions);
  username?.addEventListener("focus", updateSuggestions);
  username?.addEventListener("keydown", (event) => {
    if (!suggestionBox || suggestionBox.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex - 1);
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectSuggestion(visibleSuggestions()[activeSuggestionIndex]);
    } else if (event.key === "Escape") {
      hideSuggestions();
    }
  });
  username?.addEventListener("blur", () => {
    window.setTimeout(hideSuggestions, 140);
  });

  options.forEach((option) => {
    option.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectSuggestion(option);
    });
  });

  role?.addEventListener("change", () => {
    const selectedLabel = roleToLabel.get(role.value);
    if (selectedLabel && username) {
      username.value = selectedLabel;
      hideSuggestions();
    }
  });

  if (page.classList.contains("is-open")) {
    trigger.setAttribute("aria-expanded", "true");
    card.removeAttribute("aria-hidden");
    card.removeAttribute("inert");
    return;
  }

  trigger.addEventListener("click", open, { once: true });
}

document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  window.setInterval(updateClock, 1000);
  bindTabs();
  bindLineage();
  bindInsights();
  initEchartsTheme();
  bindMapOverlayVisibility();
  setActiveTabs(activeDept);

  const view = document.body.dataset.view;
  if (view === "login") {
    initLoginReveal();
  } else if (view === "status") {
    loadStatus(activeDept, { showDepartmentCards: summaryModeFromUrl() === "department" }).catch(showLoadError);
  } else if (view === "district" || view === "area") {
    loadDetail(activeDept).catch(showLoadError);
  }
});
