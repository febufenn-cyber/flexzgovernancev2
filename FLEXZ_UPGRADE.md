# Flexz Governance — Upgrade & Pitch Plan (TVK Government, Tamil Nadu)

> Goal: convert the "Tamil Nadu Governance Grid" prototype from an impressive-but-game-like
> tech demo into a **production-grade, authority-facing governance command centre** that a
> Chief Secretary / Minister / District Collector would actually run a morning review on —
> and that wins the contract with the newly formed TVK government.
>
> **Local-only:** all changes are to the local clone. The Bitbucket remote is never touched.

---

## 0. Positioning (the single most important reframe)

The client originally pointed at **mygov.in** — but that is *citizen engagement*. The right
references for an **authority/minister monitoring** product are India's real command centres:

| Reference | What to steal |
|---|---|
| **AP Real-Time Governance Society (RTGS)** | Real-time, cross-department "one government" command centre; incident management (log → assign → resolve with timeline). |
| **PMO PRAGATI** | Review-meeting ritual: drill into one stalled project full-screen with data + map proof, named officers answerable. |
| **Telangana TG-DMS / CSMS (Maharashtra)** | Per-department KPI scorecards (87 parameters), Collector dashboard, "compulsory for all departments". |
| **NITI Champions of Change** | **Delta ranking** — rank districts/officers on *pace of improvement*, not just absolute level. Drives competition. |
| **DISHA / DARPAN (NIC)** | State→district→block→GP drill-down; ministry-approved KPI definitions; API-integrated, multilingual, configurable. |

**Compliance bar:** GIGW 3.0 (WCAG 2.1 AA), State Emblem placement rules (2007), bilingual Tamil/English.

**Political sensitivity (decided default):** Do **NOT** theme the product wall-to-wall in TVK
party colours — it reads as partisan propaganda and can backfire with the bureaucrats who score
the pitch. Use **TVK dark-red (#A20000 → #C8102E) + gold (#FFCA00) as a restrained brand accent**
over an institutional navy/slate base; lead the masthead with the **Government of Tamil Nadu emblem**,
not party iconography. (Dial accent up only on explicit instruction.)

---

## 1. TVK brand facts (verified, with sources)

- **Flag:** horizontal three bands — dark-red / **gold-yellow (centre)** / dark-red — with a
  dark-red circular medallion (Vaagai victory flower, ringed by florets) flanked by **two grey
  elephants**. No founder image. (Wikipedia + Kerala Kaumudi + Business Today + The News Minute.)
- **Official colours (named):** "Dark Red" + "Yellow" (Wikipedia). **No official hex spec exists.**
- **Measured hexes (from the Wikipedia flag image — treat as best estimate):**
  dark red **#A20000**, gold **#FFCA00**, Vaagai crimson **#B41321**, elephants warm-grey ~#9C9579.
- **Brand anchors to use:** red **#C8102E** (brightened for UI legibility) / maroon **#9E1B1B**
  (true flag tone) + gold **#F2B807 / #FFCA00**. Keep **status-red distinct from brand-red** so a
  "critical" alert never reads as "party colour".

---

## 2. "Looks like a game" audit (verified against the real files)

### Keep — already government-grade (lead the demo with these)
- **Data-lineage modal** ("where these numbers come from"): real source names (CCTNS, e-FIR, ERSS 112,
  ICJS, HMIS, 108 EMRI, IHIP/IDSP, ePoS, TNPDS, DOS, 1967). Provenance = what a Chief Secretary demands.
- **Source freshness telemetry** (live/delayed/offline, last-sync, latency, records-today).
- **IST clock, RAG legend, lakh/crore Indian number formatting.**
- **Command palette (⌘K)** — genuine pro pattern, full keyboard nav + ARIA. (Rename the
  "Palantir Gotham-style" code comment.)
- **`live.js` gentle metric movement** — keep the motion, repoint to real polling later.

### Remove / tone down — the offenders
| Element | File(s) | Verdict |
|---|---|---|
| three.js globe "GRID ACQUISITION SEQUENCE" login intro | `login-intro.js`, importmap in `base.html` | **REMOVE** — reads as a sci-fi cutscene + state-surveillance targeting. Replace with quiet emblem splash. |
| Number **decrypt/scramble** FX | `hud.js`, CSS `.decoding` | **REMOVE** — "encrypting KPIs" undermines trust; numbers must appear instant & still. |
| Map **radar-ping beacon** (neon green) | `dashboard.js:~309-330`, CSS `.map-beacon`/`@keyframes beacon-*` | **REMOVE** ping; keep a static labelled callout for the priority district. |
| **Pulsing neon top-district outline** | CSS `@keyframes top-blink` (~2621) | **TONE DOWN** to a solid accent border, no blink. |
| **CRT scanlines** | CSS `body.tn-root::before` (~2876) | **REMOVE.** |
| **Radar scan-sweep** over the map | CSS `.svg-stage::before` `@keyframes scan-sweep` (~2955) | **REMOVE.** |
| **DEFCON "Operational Readiness LEVEL 1-5 SEVERE…"** | `fusion-center.js:24-108` (also DEAD) | **REMOVE** militarised framing → civil "State Pressure Index". |
| Neon-on-black palette + glassmorphism + glow | `app.css` (`:root`, 37× cyan glow, 59 box-shadows, 19 backdrop-filters) | **RESKIN** → institutional. Biggest single lever. |
| GSAP entrance (SplitText char-fly-in, card pop) | `fx-anim.js` | **TONE DOWN** to one quiet fade. |
| Arcade tabs `P`/`H`/`D`, `◆` "Fusion / Cross-Dept Risk" | `status_view.html:34-47` | **TONE DOWN** — full names, rename "Fusion". |
| "Fusion Center / Fusion bar" branding (US-intel term) | `base.html:36,128`, `fusion-center.js` | **RENAME** → "State Command Centre / Integrated Dashboard". |
| "Automatic Spike" label + spike glow | `status_view.html:53`, CSS spike keyframes | **RENAME** → "Priority District / Highest Load". |
| Dead code (renders nothing) | `fusion-center.js` readiness/feed-board/ops-journal/playback; `app.css` `.classbar` | **DELETE.** |

### Biggest substance problem (not visual)
`thresholds.py` assigns RAG by **percentile rank** (fixed ~30% red / 27% amber every run, regardless
of real performance) and, for Police, treats **more FIRs filed = Critical** — arguably backwards
(more filings can mean better citizen access). A Collector spots this in 30 seconds. **Replacing it
with real thresholds + targets is P0.**

---

## 3. Feature roadmap (prioritised to win the contract)

### P0 — must-have for the pitch
1. **Real KPI thresholds + targets** (replace percentile rank); per-metric RAG bands with
   directionality + target-vs-actual delta. `thresholds.py`, `seed_data.py`, `api.py`.
2. **Role-based authorization & real personas** (CM/CS statewide, Collector own district, Dept Head
   own dept) — scope querysets in `api.py`/`views.py`. Today every role sees identical data.
3. **Scheme / welfare-delivery monitoring** — beneficiaries targeted vs reached, funds released vs
   utilised, district leaderboard. *The single most contract-winning module for a welfare government.*
4. **Grievance / complaint SLA tracking** — ageing buckets, breach flags, auto-escalation.
5. **Reports / PDF export** with emblem + timestamp + "data as of".
6. **Institutional theme** (light default + tamed dark toggle).

### P1 — strongly differentiating
- Real **live data movement** (polling/SSE against the API, "Data as of HH:MM IST", auto-refresh).
- **Alerts & escalation engine** (breach → assignee → timer → ack/resolve trail).
- **Project / works tracking** (physical vs financial progress, delayed-works flags).
- **Audit trail** (who viewed/exported/acknowledged what).
- **Bilingual Tamil/English + GIGW accessibility.**
- **Data-source freshness SLA panel** (resurrect the dead feed-board, wired properly).

### P2 — breadth & polish
- Trend forecasting / anomaly flags on the 14-day series; comparative benchmarking + rank movement;
  mobile/tablet collector view; scheduled email/WhatsApp digest; map drill to taluk/block.

---

## 4. Department expansion (whole-of-government demo breadth)

Current: Police, Health, PDS. Add (additive data work in `seed_data.py`, each mapped to a real TN
system + flagship scheme so the lineage modal stays credible):

| Dept | Demo KPIs | Real source | Scheme hook |
|---|---|---|---|
| Revenue / Disaster Mgmt | e-Sevai SLAs, relief disbursed | e-Sevai, CMRF | Certificate delivery, calamity relief |
| Rural Dev / Panchayat | MGNREGA person-days, works | NREGASoft | Village infrastructure |
| School Education | attendance, outcomes, infra | EMIS/UDISE+ | Breakfast Scheme, Pudhumai Penn |
| Social Welfare / Women | DBT to women, pensions, Anganwadi | TN DBT | Kalaignar Magalir-style monthly assistance |
| Agriculture | crop coverage, procurement | Uzhavan | Farmer welfare |
| Water / TWAD | piped-water coverage, quality | TWAD/JJM | Drinking-water access |
| Electricity / TANGEDCO | SAIDI/outage, feeder uptime | TANGEDCO | Subsidised power |
| Transport | fleet availability, accident hotspots | STU | Vidiyal Payanam (free women's travel) |

**Demo-first set:** Revenue, Rural Dev (MGNREGA), Social Welfare (women's DBT), Water — most visibly
"welfare delivery", aligned with TVK positioning.

---

## 5. UI/UX direction (production-grade authority look)
- **Default = institutional light**: off-white canvas, white cards, hairline borders, soft shadows —
  no glow, no glassmorphism, no scanlines. **Optional tamed "Command Centre (dark)"** behind a toggle.
- **Accent:** restrained institutional navy + **TVK red brand accent**, **gold** as secondary highlight.
  Status RAG stays but desaturated & AA-compliant, kept distinct from brand red.
- **Typography:** keep IBM Plex Sans/Mono (has Tamil sibling); drop heavy uppercase letter-spacing.
- **Layout:** dense but calm — left rail, top bar (emblem, title, role, IST clock, export), KPI cards
  with target-vs-actual + sparkline + status chip; tables for drill-downs.
- **Charts:** flat bars/lines, gridlines, labels, "as-of" captions; no neon fills.
- **Map:** clean choropleth, flat RAG fills, thin borders, static labelled callout for priority
  district. No beacon / sweep / blink.
- **Motion:** quiet fades + first-load count-up only. Nothing loops forever.

---

## 6. Quick wins (exact files, max visible improvement)
1. **Reskin `:root` tokens** in `app.css:1-15` (most rules inherit) + delete decorative HUD block
   (scanlines, scan-sweep, beacon keyframes, `.decoding`) and dead `.classbar`.
2. **Disable game FX scripts** in `base.html:15-31` — drop `hud.js`, `login-intro.js` + three.js
   importmap + GSAP (`fx-anim.js`, SplitText). Keep `dashboard.js`, `command-palette.js`, `live.js`,
   `fusion-center.js`.
3. **Remove map beacon** `dashboard.js:~309-330`; replace `top-blink` with static border.
4. **Fix status logic** `thresholds.py` + `seed_data.py::_assign_statuses` — real thresholds + targets;
   fix Police directionality (pendency/disposal, not raw FIR count).
5. **Rename game-y labels** — "Automatic Spike"→"Priority District"; full dept names; drop `◆`/"Fusion";
   "Fusion bar/Center"→"State Command Centre".
6. **Realistic welfare-led data** in `seed_data.py` (+ new departments, schemes, plausible magnitudes).
7. **Targets + "data as of"** in `api.py` (`serialize_department_metric`, `district_summary`).
8. **Real role scoping** in `views.py` + `api.py` (key off `request.session["role"]`).

---

## 7. Risks / sensitivities
- **Surveillance framing** is the political landmine — reframe end-to-end as **welfare & service
  delivery** governance; Police is just one ordinary department. Strip all intel/military vocabulary.
- **Party-colour sensitivity** — accent only, never wall-to-wall; never the party logo/slogan/founder.
- **Data honesty** — keep the "synthetic demo" disclaimer visible; don't over-claim "live" to officials
  who know CCTNS/HMIS/TNPDS. Present as a prototype wired to *named real systems* pending integration.
- **Security/auth** (before any real pilot): real auth/SSO, per-role scoping, audit log, HTTPS/CSRF
  hardening, move SQLite → Postgres. Frame as the "production hardening" line item.

---

## 8. Execution log (this is a self-paced build loop)
- [x] **Iter 0** — research (TVK brand, gov command-centre references, codebase audit) + this plan.
- [x] **Iter 1** — killed game FX (login globe + three.js importmap, scramble `hud.js`, GSAP `fx-anim.js`)
      in `base.html`; de-neoned `:root` palette → institutional navy + TVK red/gold accent tokens;
      cleaned body background (removed grid overlay). Cache-bust bumped to `gov1`.
- [x] **Iter 2** — stood up venv + ran/verified via Preview MCP. Discovered a **second
      authoritative `:root`** (line ~2482) + a "cinematic" body-bg block were overriding iter-1;
      re-themed the winning layer → institutional navy + TVK red/gold tokens (verified live:
      `--brand #c8102e`, de-neoned status). Tamed body bg (removed aurora/grid/film-grain),
      neon topbar hairline → TVK accent, removed map **beacon** (`dashboard.js`) + **top-blink**
      + **scan-sweep**, renamed "Fusion Center"→"State Command Centre"/"Integrated Analysis",
      "Automatic Spike"→"Priority District", "Fusion/Cross-Dept Risk"→"Combined/Cross-Department".
      `manage.py check` clean; no console errors.
- [x] **Logo swap** (user-supplied) — cropped the new Flexz knot mark out of `Flexzai Final 1.png`
      (excluded the embedded white wordmark), saved transparent square `img/flexz-mark.png` (320²);
      pointed `base.html` topbar + `login.html` + favicon to it; wordmark text → **"Flexz Governance"**
      with "Tamil Nadu Governance Grid · Integrated Command Centre" as subtitle. Verified on both
      screens. NOTE: this server **caches templates** — restart the preview server after template
      edits or the change won't show.
- [x] **Iter 3** — **real KPI thresholds + targets** (multi-agent workflow). `thresholds.py`
      `DEPT_THRESHOLDS` + `band_info()` replace percentile rank with absolute target-anchored RAG
      bands; Police now scored on **pendency %** not raw FIR count; `api.py` emits
      `target`/`delta_vs_target`/`direction`/`as_of`. Verified: 0 status↔band mismatches across 540
      metrics; distribution no longer a fixed 30/27/43 split.
- [x] **Iter 4** — institutional **light theme (default) + toggle** (workflow): additive
      `html[data-theme="light"]` block + pre-paint script + `theme.js` (localStorage). Dark "command"
      theme untouched/reversible. Verified both themes render in-browser.
- [x] **Iter 6** — **server-side role scoping** (workflow): `roles.py` `clamp_department`/
      `allowed_departments` enforced in every endpoint; ministers can't read foreign departments.
- [x] **Globe intro RESTORED** (user request) — re-hooked GSAP + three.js importmap + `login-intro.js`
      in `base.html` (scramble/bouncy FX stay out). Loads with no console errors.
- [x] **Pressure-test fixes** (5 adversarial reviewers → fixed): **🔒 SECURITY** — role was
      self-asserted at login (a minister could pick "Chief Minister" and read everything) and failed
      OPEN for unknown/admin roles; now derived from authenticated identity (`role_for_user`) and
      **fails closed** (empty set → 403). Empirically verified: escalation blocked, no-role → 403.
      **Priority District** ranked by raw FIR count → now by **governance severity** (Chennai 61%
      pendency, shown as "Pendency 61%", not Tiruvallur's 3,520 FIRs). **Light theme** lineage-modal
      dark-on-light (invisible text) + login dark slab → fixed (white, readable). **Dark theme** CRT
      scanlines/grid → removed. **Forever-pulse** loops (priority district/ward/lineage nodes) → killed.
- [x] **FOSS integrations** (multi-agent workflow + pressure-test, all 4 user-selected):
      **Public Sans** self-hosted (USWDS typeface; correctly licensed **OFL-1.1**, OFL.txt bundled)
      + USWDS 8px spacing/type tokens; **Tabler** CSS idioms (MIT — stat-card + status chip + data-table
      styling, no framework imported); **Apache ECharts** (vendored ~1 MB) — trend chart migrated off
      Chart.js (now removed) AND the SVG map replaced by a **data-bound GeoJSON choropleth** keyed on
      `code` (30/30 match, SVG kept as fallback); **Grafana** scaffolded (compose + SQLite-datasource
      provisioning + README) behind `GRAFANA_PANEL_URL` with a `<details>` placeholder when absent.
      Verified in-browser: ECharts choropleth renders (canvas, RAG colours), Public Sans is the live
      body font, both themes clean, Grafana-absent placeholder clean, no console errors.
      **Post-fixes:** closed the offline gap — self-hosted **Archivo + IBM Plex Mono** and removed the
      Google Fonts CDN `<link>` (now fully air-gap-capable); fixed ECharts tooltip font; fixed the
      collapsed (28px) trend-chart container → `min-height:160px`.
- [x] **Iter 5 — data realism** (workflow): `seed_data.make_metrics` rewritten — size now dominates
      magnitude (Chennai 3675 beds > Perambalur 1144), police pendency re-centred (~28% mean),
      ration_shops derived from users (~900-1800/shop); wards now **partition** their district totals
      (sum==district, no ward exceeds parent). Determinism + invariant (top district red) verified.
      NOTE: police shows only 1 red district by construction (pendency caps below the 45% red band) —
      a demo-tuning option is to widen the pendency range for a richer red spread.
- [x] **User-reported regression fixes** (live browser, verified): (1) **scroll** — relaxed the
      `height:100vh; overflow:hidden` fit-to-viewport lock so the page scrolls (tabs + Live Ops were
      clipped). (2) **dept tabs (Police/Health/PDS/Combined) unclickable** — the ECharts canvas
      overlay sat over the tabs + a per-element binding init-race; fixed by **reverting the map to
      SVG** (which you preferred — better fit), `z-index` on `.map-tabs`, and **event-delegation**
      binding in dashboard.js + fusion-center.js. (3) **priority-district blink** restored
      (`flexz-top-blink`). (4) **map fit** — back to the SVG choropleth.
- [x] **Grafana LIVE with synthetic data** — local Grafana OSS binary (~/AI/grafana, port 3001,
      anonymous + embedding) + frser-sqlite-datasource → `db.sqlite3`; "Flexz Overview" dashboard
      provisioned (district status counts, top pendency). `GRAFANA_PANEL_URL` default wired; the
      "Live Ops (Grafana)" section now embeds the live panel. Start script: `~/AI/grafana/start-grafana.cmd`.
- [ ] **Iter 7** — department expansion (Revenue, Rural Dev, Social Welfare, Water) — vetted blueprint
      ready from the workflow's design-only phase.
- [ ] **Iter 8** — cleanup: delete dead FX (`hud.js`/`fx-anim.js`, `.classbar`/`.decoding`), arcade
      tab glyphs P/H/D + ◆, PDS always-red card tone, single-dept minister hardcoded strings.
- [ ] **Iter 9** — PDF/report export; alerts & escalation; GoTN emblem masthead; bilingual Tamil +
      GIGW accessibility pass; final verification.

### UX refinement pass (user feedback)
- **Theme simplified to a background-only toggle**: `grey` (vault-grey, default) ↔ `dark` (navy).
  The white "institutional light" theme over-recoloured everything (map/cards), so it's orphaned
  (toggle now uses `grey`/`dark`; ~130 `[data-theme="light"]` rules are dead — safe to delete).
  Only the page background changes; map + RAG status + accents stay identical.
- **Layout**: restored fit-to-one-screen (no scroll) and made the shell **full-width** (removed the
  max-1480px side gutters — fills the screen edge-to-edge).
- **Grafana moved out of the inline scroll → a topbar "Live Ops" button that opens a popup modal**
  (`#grafana-modal`) with the live Grafana panels (lazy-loaded iframe). Verified rendering the
  synthetic data. ECharts map overlay confirmed reverted (SVG fits better).

### UX pass 2 (user feedback)
- **Grafana + Live Ops TOTALLY removed**: topbar button, popup modal, `bindGrafana` JS, view
  context, `GRAFANA_PANEL_URL` setting, all `.liveops`/`.grafana` CSS, the `infra/grafana` scaffold,
  the `~/AI/grafana` binary, and the running server. Zero references remain.
- **Grey "boxes" too**: the `grey` theme now overrides the surface tokens (--glass/--panel/--line),
  so panels & cards are grey (a step lighter than the canvas), not navy-on-grey.
- **More TVK flag colour** (red #c8102e + gold #f2b807): red→gold→red flag band on the command bar,
  TVK-red "Live Demo" pill, gold section eyebrows + gold KPI-card top edge, red section-title bars,
  red active-tab underline, gold AI mark, red "Live Alerts" LED, gold-tinted wordmark.
