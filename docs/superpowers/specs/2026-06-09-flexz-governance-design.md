# FLEXZ GOVERNANCE — MASTER DESIGN BLUEPRINT
**Date:** 2026-06-09 · **Status:** Coordination contract (the single source of truth every feature plan binds to)
**App:** Django 5 + DRF + SQLite · vanilla JS + Chart.js/ECharts · at `C:\Users\zervv_ltv1azu\OneDrive - Zervvo Technologies\Desktop\New folder (3)\flexz-governance_v2`

This blueprint synthesises the full planning round (screen architecture, design system, ten feature plans, the screen-fit review, and the governance-credibility review) into ONE buildable spec. It resolves every contradiction the reviews surfaced and folds in every fix. No placeholders. All data is synthetic and deterministic for the pitch.

---

## 1. PRODUCT VISION + THE SOUL + POSITIONING

### 1.1 What it is
**Flexz Governance — "Ready-Made Governance":** an AI-powered governance OPERATING SYSTEM for the newly-formed TVK government of Tamil Nadu — a brand-new administration, new to governing. It is **NOT a passive monitoring dashboard.** It is a guided governance COPILOT pre-loaded with the playbook of HOW to run a state, so a first-time CM / Minister / IAS / IPS governs like a 20-year veteran from day one. **Most dashboards INFORM; this one TEACHES and DIRECTS.**

### 1.2 The SOUL — every screen must serve all four
1. **REASSURANCE (implicit, never a banner).** Officials feel in control because they are continuously GUIDED on the next move. No literal "everything is fine / 94% on track, relax" copy — calm is *engineered* through clean 8px structure + always knowing what to do next.
2. **COMPETENCE AMPLIFICATION.** The system tells a novice what a seasoned administrator would do: top priorities + a RECOMMENDED ACTION with its REASONING (it teaches judgment, not just data).
3. **ACTIVE GOVERNING.** Officials ACT inside it — direct/assign to a named officer with a deadline, schedule a review, escalate, follow up. It records their diligence (which becomes the defence trail).
4. *(strategic layers below all feed these three)*

### 1.3 Strategic layers
- **PRIDE / prestige:** a rare, world-class showpiece (esp. the CM Situation Room) the government proudly shows other states, countries, the press. Must LOOK like advanced, valuable technology.
- **DEFENCE / political armour:** continuously produces PROOF of effective governance ("Our Record") + a RAPID-REBUTTAL mode to counter "your governance is ineffective" attacks instantly with data + ready talking points.
- **RELIEF:** the first demo must land as "thank god — this is exactly what I always wanted."

### 1.4 Positioning
Flexz takes **full responsibility (A-Z managed service)**; ministers bear ZERO burden. The government grants permission + data access; Flexz does 100% of the technical + ground work. The product is a **Build-Operate managed service** over the unified **"Tamil Nadu State Data Spine."**

### 1.5 The non-negotiable screen constraint
Desktop, LIMITED screen. **Must FIT ONE SCREEN — NO SCROLL. FULL-WIDTH, edge-to-edge, NO side gutters.** Information density matters. DEPTH is reached via modals / slide-over drawers / tabs / focus-mode — NEVER scroll. Engineering-grade: every panel placed deliberately, like a designer architected it.

### 1.6 References drawn from
AP RTGS (real-time command centre + incident lifecycle log→assign→resolve) · PMO PRAGATI (full-screen drill into one item with map + named accountable officer) · Telangana TG-DMS (per-department KPI scorecards) · NITI Champions-of-Change (DELTA/improvement ranking) · NIC DARPAN (state→district→block drill-down).

---

## 2. SHARED SCREEN ARCHITECTURE + DESIGN SYSTEM (the coordination contract)

### 2.1 THE LAW — vertical budget (the scarce axis)
Horizontal is cheap (full-width, scales to a wall). **Vertical is the only scarce axis.** Budget in vh fractions, reference height 820px. One-screen enforced at `app.css:1883` (`height:100dvh; overflow:hidden`).

| Band | Element | px (820 ref) | vh | Flex |
|---|---|---|---|---|
| 0 | **Alert crawl** (`fusionbar`) | 28 | 3.4 | fixed `0 0 auto` |
| 1 | **Command Bar** (`topbar` — brand, ⌘K, AI, mode title, clock, identity) | 60 | 7.3 | fixed |
| 2 | **KPI + PROOF strip** (`cards`) | 96 | 11.7 | fixed |
| 3 | **MAIN REGION** (Zones B–E grid) | fills | ~72.5 | **`1 1 auto; min-height:0`** (the only flex band) |
| 4 | **Footer / lineage ribbon** | 22 | 2.7 | fixed |
| | gaps (3×~8) | 24 | 2.4 | — |
| | **TOTAL** | **820** | **100** | no scroll |

**Enforcement (non-negotiable):** Bands 0/1/2/4 are `flex:0 0 auto`; **no feature may add a new fixed band.** Band 3 absorbs all slack (`min-height:0`). Anything exceeding its zone is **pushed to a depth surface**, never allowed to grow the page. The left rail is horizontal-only → **0vh**.

### 2.2 The screen frame
```
┌────────────────────────────────────────────────────────────────────────────┐
│ BAND 0 ▸ ALERT CRAWL (live statewide critical ticker, full-width)           │ 3.4vh
├──┬─────────────────────────────────────────────────────────────────────────┤
│  │ BAND 1 ▸ COMMAND BAR  brand │ ⌘K │ AI │ [mode title] │ த⇄EN │ ☾ │ clk │ id │ 7.3vh
│ L├─────────────────────────────────────────────────────────────────────────┤
│ E│ BAND 2 ▸ ZONE A: KPI tiles (live)        ║  PROOF tile(s) (our record)   │ 11.7vh
│ F├──────────────────────────────────────────╨──────────────────────────────┤
│ T│ BAND 3 — MAIN REGION                                                     │
│  │ ┌────────────────────────┬──────────────────┬──────────────────────────┐ │
│ R│ │ ZONE B HERO            │ ZONE C            │ ZONE D                    │ │
│ A│ │ (map / scorecards /    │ WHAT NEEDS YOU    │ INCIDENT / ALERT RAIL     │ │ ~72.5vh
│ I│ │  focus canvas)         │ + RECOMMENDED     │ (lifecycle queue)         │ │
│ L│ │                        │ ACTION + REASON   │                           │ │
│56│ └────────────────────────┴──────────────────┴──────────────────────────┘ │
│px│                  [ZONE E: context tab bar — dept / combined]              │
├──┴─────────────────────────────────────────────────────────────────────────┤
│ BAND 4 ▸ FOOTER / lineage ribbon (synthetic-data honesty + freshness)        │ 2.7vh
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Navigation chassis — DECISION: thin ~56px LEFT ICON RAIL (not top-tabs)
Vertical is scarce, horizontal is free → a left rail costs **0vh** and reads as a command console on a wall. Four-tier navigation, each tier one home:

| Tier | Switches | Mechanism | Cost |
|---|---|---|---|
| 1 · MODE | **Cockpit · Proof · Spine · Help** (4 only — see §2.4) | left icon rail (active = TVK-red bar) | 0vh |
| 2 · COMMAND | search, AI brief, language, theme, identity, clock | Command Bar (Band 1) | shared |
| 3 · CONTEXT | dept/lens within a cockpit (Police/Health/PDS/Combined/**Schemes/Works**) | Zone E tab bar (`.dept-tab`, role-scoped) | inside Band 3 |
| 4 · DRILL | State → District → Ward | breadcrumb + map click → page-nav | page swap |
| ⌘K | jump anywhere | command palette (`#cmdk`) | overlay |

### 2.4 RAIL-MODE DISCIPLINE (resolves the screen-fit review's mode-proliferation conflict)
The planning round minted 8 candidate modes; the rule below collapses them to **4**:
- **Rail MODE** ⟺ a feature that re-keys the entire six-zone grid to a *different data spine* AND is whole-of-government → **Cockpit, Proof, Spine, Help.**
- **Zone E tab** ⟺ a lens *within* a cockpit reusing the same zones → Police/Health/PDS/Combined, **and Schemes and Works** (department-like portfolios that swap Zone B/A content).
- **Overlay (no mode)** ⟺ Grievance/Responsiveness (a focus-mode/drawer proof surface) and Briefings (focus-mode). Neither is a standing grid.

This also fixes the incoherence where a scoped minister would see a "Schemes" rail mode they can't fully populate.

### 2.5 THE DEPTH MODEL — four sanctioned no-scroll escape valves
The home never scrolls and never grows. Depth is reached on these, with a deterministic decision rule:

| Surface | When | Page budget | Primitive |
|---|---|---|---|
| **Inline** | data fits the zone's fixed slot | within zone | the zone |
| **Right slide-over DRAWER** | depth on the same entity — drill detail, AI brief, **action composer** (assign/deadline/escalate), dossier | **0px overlay** | `#aibrief` |
| **MODAL** | focused interrupt — lineage/source peek, escalation matrix, confirm/commit | **0px overlay** | `#lineage-modal` |
| **FOCUS / REVIEW MODE** (new) | deliberate single-item review (PRAGATI) — `focus--item`; multi-column reading sheet — `focus--sheet` | **0px overlay** | new, on drawer/modal infra |
| **PAGE-NAV** | the drill hierarchy State→District→Ward | page swap | breadcrumb (existing) |
| **⌘K palette** | jump anywhere | **0px overlay** | `#cmdk` |

**GOLDEN RULE:** if a feature threatens the page budget → push it to drawer/modal/focus-mode. Never grow Band 3, never add a band, never introduce scroll. Lists are **fixed-height `overflow:hidden`**, truncate to "+N more → drawer," never scroll inline. Live updates mutate in place (no layout shift).

### 2.6 DESIGN SYSTEM — palette & color governance
Tokens already live in `app.css` (`:root` ~2506, theme blocks ~4922, TVK accents ~4958). Reuse names verbatim; new tokens flagged `[NEW]`.

**Surfaces (theme-variant grey↔dark only):** `--bg`, `--bg-2`, `--glass`/`--glass-2`, `--line`/`--line-2`, `--text`/`--muted`/`--faint`.
**Status RAG (theme-invariant):** `--green #2fb37f` · `--amber #e0a32a` · `--red #e2483f`. AA-verified on both surfaces.
**Accent + brand:** `--accent`/`--cyan #5b8fc7` (steel-blue, the neutral interactive accent) · `--brand #c8102e` (TVK red) · `--brand-2 #9e1b1b` · `--gold #f2b807`.
`[NEW]` semantic aliases: `--status-crit:var(--red)` · `--status-watch:var(--amber)` · `--status-ok:var(--green)` · `--focus-ring:var(--accent)` · `--brand-edge:var(--gold)`.

**The four hard color rules (every plan obeys):**
1. **RAG ≠ Brand.** Status-red `#e2483f` (judgment) and TVK-red `#c8102e` (identity chrome only) must NEVER appear adjacent in the same role. A "critical" alert may never render brand-red. Verify on both `#2c313a` and `#0a1020`.
2. **Gold = large non-text accents only, never body text** (fails AA as text). Allowed: card top-edge (2px), AI-mark border, progress fill on dark.
3. **One accent per region.** Steel-blue is the default interactive color. Brand red/gold are seasoning, capped at chrome touchpoints.
4. **Color is never the only signal** (WCAG/GIGW). Every RAG state pairs hue + glyph + word ("CRITICAL"/"WATCH"/"ON TRACK").

### 2.7 DESIGN SYSTEM — typography
- `--font-sans` Public Sans — body, labels, UI, table text.
- `[NEW] --font-mono` IBM Plex Mono — **every numeral**, always `tabular-nums` (column alignment is itself a prestige cue).
- `[NEW] --font-display` Archivo — uppercase command headings only (tracking ≤`.04em`); never body/KPI numerals.
- `[NEW] --font-tamil` self-hosted Tamil OFL face (Noto Sans Tamil / Catamaran) — Tamil text runs only.

Scale (reuse + `[NEW]`): `--type-kpi-lg 40` · `--type-kpi-md 32` · `--type-kpi-sm 20` · `--type-title 24` · `[NEW] --type-kpi-xl 56` (focus hero) · `[NEW] --type-display 28` · `[NEW] --type-body 13` · `[NEW] --type-table 12.5 mono` · `[NEW] --type-label 11.5/700/.06em UPPER` · `[NEW] --type-micro 10.5/800/.1em UPPER`.
**Rule:** labels = muted uppercase sans; values = `--text`/status color, IBM Plex Mono tabular. Never set a KPI numeral in sans.

### 2.8 DESIGN SYSTEM — spacing, radii, elevation, motion
- **Spacing** 8px scale: `--space-1..6` = 8/16/24/32/40/48. Card pad `--space-2`; panel pad `--space-3`; tight rows 12–13px.
- `[NEW]` **radii:** `--r-chip 999` · `--r-sm 8` · `--r-md 12` · `--r-lg 15` · `--r-xl 18` · `--r-2xl 22`.
- **Elevation:** `--shadow-1` (panel), `--shadow-2` (modal). Max one shadow tier per surface; backdrop-blur only on panels/modals.
- `[NEW]` **motion:** `--ease-out cubic-bezier(.2,.84,.26,1)` · `--dur-fast .16s` · `--dur-base .28s` · `--dur-enter .56s`.
- **Motion law:** (a) one entrance fade per view; (b) KPI count-up ONCE on first load; (c) transitions on hover/focus/select only; (d) **nothing loops forever** — no infinite pulse/blink/sweep/marquee as a permanent attractor. Priority district = a **solid** accent border, not animation. `prefers-reduced-motion` disables count-up + transitions. **CLEANUP:** remove `@keyframes spike` (priority blink), the `.alert-marquee` infinite scroll, and the "critical ward blinks" badge.

### 2.9 DESIGN SYSTEM — component library (each tied to the SOUL)
1. **KPI tile** (`.tile`) ≥74px · 12–13px pad · `--r-md` · value `--type-kpi-sm` mono, status via value-color or corner dot. *Reassurance.*
2. **Stat/scorecard card** (`.card`) 116px (86px clamped at status view) · top-edge `2px gold` · value `--type-kpi-md` mono · `source-info` provenance chip. *Pride + defence.*
3. **Dense data table** `[NEW]` — row 36px · header `--type-label` sticky · numerals mono right-aligned tabular · RAG via leading 9px dot + chip, never full-row wash · max ~8 rows, overflow → drawer. *Competence.*
4. **Status chip** `[NEW]` (extends `.badge`) — `--r-chip` · `--type-micro` UPPER · 7px dot · crit/watch/ok at `.13α` fill · **text label mandatory.** *Active governing.*
5. **Choropleth map** (`.tnmap` SVG, GeoJSON on `code`) — flat RAG fills `.40`, hover `.62` · **priority = solid 3.3px accent stroke, NO blink** · static callout, legend RAG dots+words · `max-height 74vh`. *Pride + reassurance.*
6. **Sparkline + charts** (`.spark`, ECharts) — single accent stroke, faint area, flat bars/lines, `--line` gridlines, mono tabular axes, "as of HH:MM IST" caption. *Defence (trajectory).*
7. **Slide-over drawer** `[NEW]` — right, `min(480px,92vw)`, full-height, `--shadow-2`, slide `--dur-base`, scrim+blur, ESC/scrim close, focus-trapped. The primary no-scroll escape valve. *Active governing + competence.*
8. **Modal** (`.lineage-modal`/`.insights-modal`) — centered `min(960–1180px)`, inner scroll only, faint engineering-grid permitted on lineage/spine modal. *Pride + defence.*
9. **Focus/Review mode** `[NEW]` — full-bleed; `focus--item` (PRAGATI: hero `--type-kpi-xl`, named officer, map locator, target-vs-actual, action rail) and `focus--sheet` (multi-column reading, e.g. Daily Brief). *Competence amplification.*
10. **Buttons** (`.btn`/`.btn-primary`) ≥40px · `--r-md` · secondary default, one primary per region · escalate/destructive uses status-red border on hover, never brand-red. *Active governing.*
11. **Leaderboard row** `[NEW]` (extends `.arow`/`.deptrow`) — rank (mono) · name · **delta chip** (▲/▼ improvement: green=improving/amber=flat/red=declining) · value (mono right). Ranks on *pace*, not absolute. *Defence + competence.*
12. **Recommended-action card** `[NEW]` — **THE SOUL COMPONENT.** Left accent bar `--accent` (advisory, never alarm) · eyebrow "RECOMMENDED ACTION" → directive (`--type-body` bold) → **WHY** reasoning (`--muted`) → action rail (Assign · Deadline · Schedule · Escalate). *Competence amplification — turns a novice into a veteran.*
13. **Alert row** (`.district-alert`) ≥66px · **3px left border in RAG status color** · status dot · `--type-micro` meta + `--type-body` text · no infinite marquee. *Active governing.*
14. **Progress-to-target bar** `[NEW]` — 8px · track `rgba(255,255,255,.06)` · fill RAG by attainment (≥100 green / 70–99 amber / <70 red, **not brand**) · optional gold target tick · mono "reached/target (xx%)" · width transition first paint only. *Defence (welfare/funds proof bar).*

### 2.10 PRESTIGE CUES — DO / DON'T
**DO:** strict 8px grid + pixel alignment; tabular-mono numerals; hairline `--line` borders; one restrained accent per region; **real provenance chips** (CCTNS/HMIS/TNPDS + last-sync + latency — the #1 prestige signal a Chief Secretary reads); calm motion (fade + single count-up); engineering-grid texture confined to spine/lineage; "data as of HH:MM IST" everywhere.
**DON'T:** neon-on-black; glassmorphism on every surface; any infinite pulse/blink/scan-sweep/radar-ping/beacon; number decrypt/scramble FX; militarised/DEFCON framing; GSAP char-fly-in; arcade glyphs; CRT scanlines; sci-fi cutscenes. **Test:** if a frame looks like a game HUD or a surveillance targeting screen, it fails.

### 2.11 THE CONTRACT TEST (every feature must satisfy one line)
> "Feature X → Zone [A–F], [inline | right-drawer | modal | focus-mode | page-nav], page budget [Nvh | 0px overlay], archetype scope [statewide | department | district]."
If a plan can't produce that line, it's redesigned onto a depth surface.

---

## 3. THE ROLE COCKPITS (one skeleton, three archetypes) — RESOLVING THE SCREEN-FIT CONFLICTS

### 3.1 The archetype map (grounded in the ACTUAL `roles.py` — 7 roles, fail-closed)
The code has **7 roles, no police/works/scheme roles.** They collapse to **3 archetypes**, all reusing the identical zone grid; only scope + Zone B hero + Zone C content + Proof tile differ.

| Archetype | Roles (`roles.py`) | Scope | Zone B hero |
|---|---|---|---|
| **STATEWIDE** | `chief_minister`, `chief_secretary`, `nodal_officer` | all depts, 30 districts | TN choropleth |
| **DEPARTMENT** | `health_minister`→health, `food_civil_supplies_minister`→pds | one dept statewide (`ROLE_DEPARTMENTS`) | dept scorecard grid / dense table |
| **DISTRICT** | `district_collector`→chennai, `district_secretary`→coimbatore | home district (`ROLE_HOME_DISTRICT`) | district/ward map |

**PROPOSED additions (NOT present — mark as roadmap in the demo):** `dgp` (DEPARTMENT→police), `superintendent_police` (DISTRICT→police, home `tiruvallur`). Until added, Police is a Zone-E lens under statewide/district, NOT its own cockpit.

### 3.2 THE GRID DECISION (the one call that gates everything — resolves screen-fit Conflict 1)
The real grid (`app.css:413`) is **two columns**: `minmax(0,1.55fr) minmax(340px,1fr)` — map + ONE `aside.panel`. There is no third middle column to "carve at 0vh." Decided per archetype:

- **STATEWIDE (map hero): keep 2 columns.** The choropleth needs the 1.55fr width. **Stack Zone C (top) + Zone D (bottom)** inside the existing right `aside.panel`, each `flex:1 1 50%; min-height:0; overflow:hidden`. This is real vertical contention, stated honestly: **Zone C shows max 3 recommended-action cards; Zone D max ~5 rows**; both truncate "+N more → drawer." On statewide, the Zone-C action rail collapses to a **single `[ ACT ▸ ]`** (the other verbs live in the composer drawer), because the panel is ~360px wide.
- **DEPARTMENT + DISTRICT (non-map hero): re-author to 3 columns** (`1.2fr / 1fr / 0.9fr`). Zone C gets its own column (~440px), so the full 4-button action rail fits. The hero here is a scorecard grid or ward map, which doesn't need 1.55fr.

One skeleton, two column-counts, decided by "is the hero a map?"

### 3.3 BAND 2 FIT FIX (resolves screen-fit Conflict 4)
Band 2 ≈ 96px; `.card` is 116px (clamped to **86px** at status view, `app.css:1957`) in a **fixed 4-column** grid. A 116px proof scorecard overflows. **Resolution:** the Proof Strip in Band 2 uses **`.tile` geometry (74–86px), NOT `.card` scorecards.** Re-proportion the 4 fixed cells to **3 live KPI tiles + 1 proof tile** (the proof tile click-opens the full Proof Engine mode). Gold-edged `.card` scorecards live in the Proof Engine *mode*, where there is room. The "split 62/38" is conceptual; mechanically it is 4 fixed cells, optionally `grid-template-columns:1.6fr 1fr` for two tile-clusters.

### 3.4 ONE statewide cockpit definition (resolves screen-fit Conflict 2)
CM Situation Room, Department Monitoring, Incident Management, Guidance Engine and Proof Strip all edit the SAME `status_view` zones rendered at once. They are **layers on one cockpit**, not competing screens:
- **Zone A** = Department Monitoring (KPIs) + Proof Strip (one tile). **Zone B** = Monitoring choropleth; CM "Cabinet view" and Works "portfolio table" are inline TOGGLES of this one hero. **Zone C** = the single Guidance Engine component (role-scoped candidates). **Zone D** = the Incident lifecycle rail — "critical/watch districts" are simply its unactioned (NEW-state) rows. **Kill the parallel passive `#alert-list`.**

### 3.5 District archetype note (resolves screen-fit Conflict 6)
`detail-grid` (`district_view.html`) is NOT `status-grid` — it's a 2-col panel grid + a full-width `.area-panel` ward grid that today renders only when top+red. Collector hero = promote the ward grid (always show home-district wards, RAG-coloured, worst ward = solid accent, no blink). This re-authors `detail-grid`; budget it as real work, not "reuse."

### 3.6 Per-archetype allocation table (the reconciled "this goes where")
| Zone | STATEWIDE (CM/CS/Nodal) | DEPARTMENT (Health/Food) | DISTRICT (Collector/Sec) |
|---|---|---|---|
| **Grid** | **2-col** (map 1.55fr + stacked C/D panel) | **3-col** (1.2/1/0.9) | **3-col**, re-authored `detail-grid` |
| **A** (Band 2, tiles@86px) | 3 KPI tiles + 1 Proof tile | same, dept-scoped | same, district-scoped |
| **B** hero | choropleth; toggle → Cabinet / Works / Schemes | scorecard grid / dense table | ward choropleth (promoted) |
| **C** Guidance | top of right panel, **3 cards, single ACT→drawer** | own column, **full 4-button rail** | own column, full rail |
| **D** Incident rail | bottom of right panel, **5 rows** | own column | own column, district-scoped |
| **E** tabs | All-Gov · Police · Health · PDS · Combined · **Schemes · Works** | single dept crest | dept lenses within home district |
| **F** | lineage ribbon | same | same |

### 3.7 The five named cockpits
- **CM Situation Room** (STATEWIDE, `chief_minister`) — the flagship pride showpiece + daily home. Zone B toggle adds **Cabinet View** (per-minister delivery scorecards, NITI delta, ACT). The wall-display hero.
- **Chief Secretary** (STATEWIDE, `chief_secretary`) — machinery-of-government. Zone B map fills by a **cross-department FRICTION score** (worst-RAG / blocked-dependency per district); Zone E "Lens" toggles Friction/Funds/Grievance-speed; Zone D = ESCALATION rail.
- **Minister** (DEPARTMENT, `health_minister`/`food_civil_supplies_minister`) — "my portfolio on one screen." Zone B = My Schemes board ⇄ District League; adds My Officers, Talking Points.
- **District Collector** (DISTRICT, `district_collector`, Chennai) — CEO of one district across all depts. Zone B = Chennai ward choropleth; Zone D = my officers (RDO/BDO/Tahsildar) + my alerts. **Server-side `clamp_district` (new, fail-closed) so a Collector can never read another district by editing a URL.**
- **SP/IPS** (DEPARTMENT/DISTRICT, *proposed* `dgp`/`superintendent_police`) — public-safety command. Scored on **FIR pendency** (not crime count). Framed as command of public safety, never a threat-scanner.

---

## 4. EVERY FEATURE/MODULE — placement, data + spine tier, guidance angle (with the reviews' fixes folded in)

> **Two cross-cutting credibility fixes applied to EVERY feature below (from the governance review):**
> **FIX-A (no fabricated specifics):** recommended actions cite ONLY on-screen synthetic values + real thresholds. **No invented case counts, no invented deadlines, and NO invented historical precedents** (e.g. never "Salem cleared this in 11 days"). Comparisons use another district's *live on-screen* value ("Coimbatore runs 22% on the same metric"). No fictional "SOP" presented as a codified state standard.
> **FIX-B (universal provenance):** every number, one click → source + freshness via the lineage modal — not just proof tiles.

### 4.1 Department Monitoring — KPIs, thresholds, map, drill-down (the substrate)
- **Placement:** Zones A+B+C+D+E. Hero inline (Zone B choropleth); depth via right-drawer (district peek + action composer), modal (lineage), focus-mode (single-district review), page-nav (State→District→Ward). 0px overlay. All archetypes.
- **Data + tier:** `band_info()` already emits `status/status_value/status_unit/target/delta_vs_target/direction` per metric — the single source of truth (seed + API never drift). `[NEW]` per district: `recommended_action{verb,owner_role,directive,why}`, `accountable_officer`, `trend_direction`, `proof_rollup`. **Tier 1** API connectors (CCTNS / HMIS-e-Hospital / TNPDS-ePoS); ward = **Tier 2** field app (`derived_area_trend` honestly mirrors "district feeds first, ward later").
- **Guidance:** the threshold itself teaches ("47% — target 25% (Critical)"). Combined cross-dept risk (`computeFusion`, `red>=2`) surfaces the veteran "main effort" instinct into Zone C.
- **Scale fix (FIX, governance review #4):** **seed 6–8 departments** (add Power/TANGEDCO, Water/TWAD, Education/EMIS, Agriculture, Revenue/e-Sevai) even shallowly — thresholds is a config dict; this converts "3-dept prototype" into a visually whole-of-government OS. Highest breadth-per-effort change; mostly seed data.

### 4.2 Guidance Engine — "What Needs You Today" + recommended actions + playbook (Zone C, THE SOUL)
- **Placement:** Zone C inline card stack + right-drawer action composer + focus-mode single-item review + confirm-modal commit. 0px new (carved per §3.2). All three archetypes, fail-closed.
- **Data + tier:** ranking reuses existing `_severity_sort_key`/`top_district_code` generalised to top-N across `allowed_departments`. `[NEW]` models: `PlaybookEntry(department,band,directive_template,why_template,sop_text,default_officer_role,escalation_target)`, `Officer`, `Directive` (the diligence ledger — the ONLY writable model). **Tier 1** live signal fires the trigger; playbook is curated institutional content.
- **Guidance (FIX, governance review #5 — teach judgment, not triage):** the WHY line must carry a *non-obvious* veteran judgment, not restate the number. Ship **6–8 genuinely non-obvious rules**: under-registration (flat FIRs + rising 112 = suppression), festival false-positive ("don't chase this spike"), upstream-of-collector ("the problem is funding, not the officer"), release>physical fraud signature. These are what make a minister think "I'd never have known that."
- **Suppression:** a metric with an open `Directive` shows "Directed · N days left," not a duplicate rec.

### 4.3 Incident & Alert Management — RTGS lifecycle (Zone D)
- **Placement:** Zone D queue inline (replaces the dead `#alert-list`); acknowledge inline; assign/escalate/resolve → right-drawer composer; single-incident review → focus-mode `focus--item`; escalation-matrix config → modal. 0px overlay. All archetypes.
- **Data + tier:** detection reuses `band_info()` (incidents can't disagree with the map). `[NEW]` `Incident` (lifecycle_state new→ack→assigned→escalated→resolved, SLA clocks, recommended_action, reasoning), `IncidentEvent` (append-only audit), `EscalationRule`. **Tier 1** detection · **Tier 2** field-app acknowledgement/resolution · **Tier 3** SLA-breach auto-escalation + helpline spikes.
- **Guidance:** auto-routes to the matrix-defined owner; SLA = taught tempo; recommended first action + WHY per breach.
- **Honesty (FIX, governance review #6):** present the loop as **"records the directive + diligence trail; the field-app (Tier 2) closes it to the officer"** — NOT a live command-and-control system. Show the field-app mock receiving it.

### 4.4 Welfare Scheme Delivery (Zone E tab, NOT a rail mode)
- **Placement:** Zone E "Schemes" tab → re-keys Zones A/B/C/D. Hero = saturation choropleth; depth via drawer (scheme×district table / officer dossier), focus-mode (single-scheme PRAGATI), modal (lineage). 0px overlay. statewide/department/district, fail-closed `allowed_schemes`.
- **Data + tier:** parallel models `Scheme`, `SchemeDistrictMetric`, `SchemeMetricPoint` + `SCHEME_THRESHOLDS`/`scheme_band_info()` mirroring the RAG engine (do NOT overload `DistrictMetric.department`). Four flagships: **Magalir Urimai Thogai, CM Breakfast, Vidiyal Payanam, CM Housing.** Tier map: Magalir = **T1** (PFMS/TNPDS), Breakfast = **T1+T2** (EMIS + field app), Vidiyal = **T3** (TNSTC ETM), Housing = **T1+T2** (MIS + geo-tagged photos).
- **Guidance:** two axes — saturation (reached/target) and absorption (released−utilised). Gap *shape* names the bottleneck: high-release/low-util = block-level execution stall ("the stall is administrative, not the treasury"). League ranks on improvement pace.
- **Boundary:** Scheme Delivery is the system of record for beneficiaries/funds; the Proof Engine *consumes* the same numbers (read-only rollup), no duplicate computation.

### 4.5 Project / Works Tracking + PRAGATI review (Zone E tab, NOT a rail mode)
- **Placement:** Zone E "Works" tab. Hero toggle = works choropleth ⇄ portfolio dense table; Zone C = stalled-works recommended actions; Zone A-right = physical/financial attainment. Depth via drawer (dossier/composer) + focus-mode (PRAGATI review). 0px overlay.
- **Data + tier:** `Work` (physical_pct, financial_pct, planned_pct_as_on, slip_days, stalled, accountable_officer, milestones, fund_releases), `WorkMilestone`, `FundRelease`, `ReviewAction`. Extend `thresholds.py` with a `works` spec + `work_band_info()` (no drift). **Tier 1** scheme MIS (NREGASoft/PMGSY/PFMS) · **Tier 2** field-app geo-tagged physical verification (closes the money-vs-asset gap) · Tier 4 citizen flag.
- **Guidance:** signature rules — `financial−physical ≥12` = over-billing/release risk; `no movement ≥45d` = stalled; declining saturation = exclusion creep. PRAGATI focus-mode = the showpiece single-project review (map locator + dual bars + named officer + "Minute this review").

### 4.6 Grievance & Complaint SLA tracking (Overlay — focus-mode + Zone A proof tile, NOT a rail mode)
- **Placement:** secondary = one "Responsiveness" Proof tile in Zone A; full loop = focus-mode/drawer surfaces. Ageing buckets hero, breach queue, recommended escalation. 0px overlay. Scope: statewide (all), department (category clamp), district (`role_home_district` clamp), fail-closed.
- **Data + tier:** `[NEW]` `Grievance` (ref_id, channel∈{1967,cm_cell,e_sevai}, category→DEPT_ORDER, district, sla_hours, status, assigned_officer, escalation_tier) + `EscalationEvent`. Derived: ageing_bucket (on_time/approaching/breached), sla_met. **Tier 1** channel CRMs + **Tier 4** citizen-as-sensor. SLA tiers are **synthetic/illustrative, stated honestly** (1967=24h, CM Cell=72h, e-Sevai=48h) — never claimed as TN statutory timelines.
- **Guidance:** pre-breach intercept (act on Approaching cluster before it tips); named-accountability default; WHY carries channel tier + trajectory.

### 4.7 "Our Record" — Performance & Proof Engine + Rapid Rebuttal (rail MODE: Proof)
- **Placement:** (a) always-on Proof tile in Zone A (all cockpits); (b) full Proof Engine = rail MODE reusing the zone grid (Zone B benchmark hero, Zone C rebuttal deck, Zone D achievement timeline); (c) Rapid Rebuttal = focus-mode `focus--item`. 0px overlay / page-swap.
- **Data + tier:** `ProofMetric` (beneficiaries reached/target, funds released/utilised, grievances resolved + speed, projects delivered), `RebuttalTopic`, `Milestone`. New `dashboard/proof.py` with `proof_band()` (mirrors `band_info`) + `rebuttal_pack()` (clamped `allowed_departments`). **Tier 1** + **Tier 4**.
- **Guidance:** picks the strongest *honest* claim (absolute vs improvement velocity — NITI Champions-of-Change); flags your softest topic proactively.
- **CRITICAL FIXES (governance review #2 — the pitch-killer):** rebut **with own operational data ONLY.** **Cut "vs previous administration" and "vs other states" from the demo and the PDF** (a new govt has no multi-year record; the opposition owns the real numbers; synthetic baselines get a minister destroyed in a press conference). The export is a **watermarked internal draft brief**, NOT a "press-ready" public artifact with the GoTN emblem asserting fabricated stats. Honest framing is stronger: "assembles your own verified delivery data into a defensible answer — it never invents a comparison you can't source."

### 4.8 Briefings & Communication — morning brief, PDF, talking points (Overlay — focus-mode)
- **Placement:** entry = Band-1 "Daily Brief" button (0vh) + ⌘K; surface = focus-mode `focus--sheet` (3-column reading sheet: Overnight / What Needs You / If Asked). Depth = action-composer drawer + lineage modal + "+N more" drawer. 0px overlay. All archetypes, role-scoped.
- **Data + tier:** a *derivation* of existing signals (same spine, new render) — `band_info` deltas, `_severity_sort_key` top-3, `MetricPoint` overnight change, proof rollup. `[NEW]` `TalkingPoint` library (q + say_template + source) and optional `BriefSnapshot` (07:00 IST cron freeze so the brief is *waiting* at login). **Tier 1**; no external tier.
- **Guidance:** "If Asked" column teaches poise — anticipates the attack, hands the veteran's frame (lead with proof, reframe the metric, close with the forward action), every SAY line a figure + named source.
- **Tamil numerals rule:** prose may use Tamil numerals; **KPI values/tables/clock/latency stay Western-Arabic in IBM Plex Mono tabular** (alignment + prestige).

### 4.9 AI Governance Assistant — "Ask the State" (Command Bar + drawer overlay)
- **Placement:** input = Band 1 Command Bar (0vh); proactive anomalies = Zone D rows tagged `AI` (advisory steel-blue border); answers/brief/rebuttal = upgraded `#aibrief` drawer (tabs: Brief · Ask · Anomalies · Rebuttal); single-anomaly review = focus-mode. 0px overlay. All archetypes, `allowed_departments` clamp.
- **Data + tier:** read+reason over the existing spine — `band_info`, `MetricPoint` slope (the anomaly source), `DataSource` provenance. **Intent parsing is a deterministic keyword/grammar matcher** (metric synonyms→`DEPT_THRESHOLDS` keys; "rose/surge"→Δ; "this week"→7-day) — no external LLM needed for the demo; clean seam to swap a real model later. **Tier 1/3/4.**
- **Guidance:** "INTERPRETED AS" line reframes amateur questions to the right metric; every answer ends in a recommended action + WHY; anomaly = the pre-breach catch a veteran would make ("would breach red in ~2 days").
- **Honesty:** numbers appear instant and still (no decrypt FX); `prefers-reduced-motion` disables count-up.

### 4.10 Cross-cutting adoption & trust layer
- **Tamil ⇄ English (+ Tamil numerals):** Band-1 toggle (`த|EN`), 0vh, clone of `theme.js`; `data-i18n` `{en,ta}` catalog for client-rendered DOM. **Requires a self-hosted Tamil OFL webface in `vendor/fonts/` (current faces are Latin-only) — ship this BEFORE any Tamil demo beat.** Numbers hold steady on toggle (proof the data layer is real).
- **GIGW 3.0 / WCAG-AA:** an audit layer over the design system (RAG+glyph+word, focus rings, focus-trapped overlays, `aria-live` alert region) + a "GIGW 3.0 · WCAG 2.1 AA" assurance chip in the foot/lineage modal. Defence + procurement de-risk. GIGW mandates local-language → Tamil discharges part of GIGW.
- **First 100 Days onboarding:** focus-mode hub + coachmarks, server-gated by the EXISTING `data-intro`/`show_intro` (the one-time login globe gate) — don't invent a new gate. `OnboardingProgress` model. Role-aware steps (orient→read map→open What-Needs-You→take first action→see record). The teaching soul made literal.
- **Recognition / NITI delta ranking:** Zone B (DEPARTMENT) "Most Improved" leaderboard + Zone A "Wins this week." Ranks on **improvement over time** computed from `MetricPoint` (day0 vs day13) — a NEW derived metric, do NOT overload `rank_districts` (which is instant-triage). `GET /api/recognition` role-clamped. Seed one district's rising red→green arc deterministically.

### 4.11 Two day-one RELIEF features the proof layer doesn't cover (governance review Tier 3)
- **First-hour crisis playbook:** for the genuinely scary event (hospital fire, communal flashpoint, dam at capacity, stampede) — "the first five calls to make and who owns each." The most emotionally resonant "ready-made governance" beat. (P2.)
- **Officer reliability ranking:** rank officers by delivery/responsiveness from the `Directive`/`IncidentEvent` ledger — the thing a novice secretly wants and would never ask for aloud. (P2.)

---

## 5. THE DATA SPINE + A-Z OPERATING MODEL + PHASED ROLLOUT (rail MODE: Spine)

### 5.1 What the Spine view is
The statewide, full-screen, 4-acquisition-tier promotion of the EXISTING per-department lineage modal (`api.py:304`, `DataSource` model `models.py:107`, animated `.lineage-packet`). A living architecture diagram: named source systems → 4 tiers → ingestion/validation/de-dup/common schema → real-time store → the cockpits, with live freshness, latency, records-today, and a data-quality score per node. Reuse the lineage render path; do NOT build a parallel system.

### 5.2 The four acquisition tiers
1. **API connectors** to existing systems (fastest real data): CCTNS, HMIS/e-Hospital, TNPDS/ePoS, NREGASoft, e-Sevai, EMIS/UDISE+, TANGEDCO, TWAD.
2. **Field-officer MOBILE APP** for last-mile (offline-first, Tamil, photo + geo-tag, dead-simple entry).
3. **Sensors / automated feeds** (water/feeder meters, CCTV/ANPR, 112/108/1967 helplines).
4. **Citizen-as-sensor** (grievance portals / feedback).

### 5.3 The spine internals
Ingestion → validation/de-dup → common governance schema → real-time store → APIs → cockpits; with data-quality scoring, freshness SLAs, lineage, security, privacy/consent, audit.

### 5.4 A-Z operating model
Build-Operate managed service; sovereign hosting (TN gov cloud / on-prem / air-gapped). Flexz does 100% of technical + ground work; the government grants permission + access.

### 5.5 Data Access & Governance track (FIX, governance review #3 — the Chief Secretary's #1 objection)
The CS has watched "unified data platform" vendors fail at integration. The Spine view must be **humble and credible, not an all-green diagram:**
- Show most connectors as **"planned / pending data-sharing MoU,"** a handful live; a mostly-amber diagram with a credible *sequencing plan* reads as a team that has done this before.
- Add an explicit **"Data Access & Governance" walkthrough**: the MoU/clearance path per source (CCTNS = NCRB/MHA + state access governance, a 6–18mo clearance problem — described as hard, not a formality), **DPDP Act / consent posture for citizen PII**, sovereign hosting, audit. This slide wins the CS — he buys the belief you can survive the integration gauntlet, not the cockpit.
- **Data:** extend `DataSource` with `acquisition_tier`, `system_owner`, `connector_type`, `quality_score`, `consent_basis`, `onboarding_status (live/pilot/planned)`, `districts_reporting`. `[NEW]` `FieldSubmission` (synthetic last-mile). One or two nodes deliberately `pending` (a fully-green diagram reads as fake).

### 5.6 Phased rollout
**90-day pilot → flagship departments → whole-of-government.** Shown as rollout chips in the Spine view, expandable to the focus-mode walkthrough.

### 5.7 Demo honesty mechanic
Every node carries a green "DEMO FEED" pill over a "→ LIVE: connect to CCTNS API" caption; Band-4 ribbon states "Synthetic demo data · spine architecture is the live-integration plan · as of HH:MM IST." We never pretend integration is done — we show a credible plan so it's "not just a pretty UI."

---

## 6. PRIORITISED BUILD SEQUENCE FOR THE PITCH DEMO (all synthetic, deterministic)

All data is seeded via the existing `rng_for(key)` md5-seeded RNG so the demo is **byte-identical every run** and rehearsable to the second.

### P0 — MUST-HAVE (the pitch cannot win without these)
1. **Left icon rail** (4 modes: Cockpit · Proof · Spine · Help) — the only new chrome; 0vh chassis.
2. **The statewide CM Situation Room** on the resolved 2-column grid (§3.2): Zone A (3 KPI tiles + 1 Proof tile, §3.3), Zone B choropleth (solid-accent priority, no blink), **Zone C Guidance Engine** (component #12, single ACT→drawer), **Zone D Incident lifecycle rail** (replaces passive list).
3. **Guidance Engine** (Zone C) with FIX-A (no fabricated specifics) + 6–8 non-obvious WHY rules; action-composer **drawer** writing a `Directive` (the diligence trail).
4. **Focus / Review mode** (`focus--item`) — the one genuinely new primitive (PRAGATI single-item review + Rapid Rebuttal).
5. **Proof Engine + Rapid Rebuttal** with FIX (own-data only; watermarked internal draft; no vs-prior/vs-states in the demo).
6. **Seed 6–8 departments** so "whole-of-government" is visually true (governance review #4).
7. **Data Spine mode** with the Data Access & Governance track + honest "pending MoU" framing (governance review #3) — the CS-winning screen.
8. **Universal provenance** (FIX-B): every number → lineage modal.
9. **Role switch** working across the 3 archetypes (statewide → department → district) on the SAME skeleton — the showpiece that proves "every level has its own command room."

### P1 — HIGH VALUE (deepen breadth + the role story)
10. **Department + District archetypes** fully realised (3-column grid; Collector ward hero with `clamp_district` fail-closed; `detail-grid` re-author).
11. **Welfare Scheme Delivery** + **Works/PRAGATI** as Zone-E tabs (the TVK-mandate centrepiece + the works war-room).
12. **AI Governance Assistant** ("Ask the State") deterministic intent grammar — the WOW pre-breach-anomaly beat.
13. **Daily Brief** (focus-mode `focus--sheet`, 07:00 freeze) + **Recognition/NITI delta** leaderboard.
14. **Tamil ⇄ English toggle** (ship the Tamil webface first) — the visceral legitimacy hook.

### P2 — POLISH / DIFFERENTIATION
15. **Grievance SLA** responsiveness overlay + **Chief Secretary friction map** + **SP/IPS** cockpit (add `dgp`/`superintendent_police` roles).
16. **First 100 Days onboarding** (reuse `data-intro` gate).
17. **First-hour crisis playbook** + **Officer reliability ranking** (the deep relief beats).
18. **GIGW/WCAG-AA assurance chip** + full a11y pass + motion cleanup (`@keyframes spike`, `.alert-marquee`, ward blink removed).

### The 60–90s demo click-path (P0, statewide → the win)
1. **Land on the CM Situation Room.** Whole of TN, RAG choropleth, one district solid-accented as priority. *"This is your government, right now."* → reassurance.
2. **Point at Zone C.** Read the recommended directive + its WHY aloud. *"It doesn't just inform — it tells a first-time CM what a 20-year Chief Secretary would do, and why."* → competence.
3. **Click the priority → focus-mode fills the wall:** hero numeral, map locator, named accountable officer, target-vs-actual. Click **ACT → drawer:** assign the named officer, set a deadline. *"And he governs, right here. The system records it."* → active governing + defence trail.
4. **Click the Proof tile → Rapid Rebuttal focus-mode:** own-data counter + ready talking points, sourced to CCTNS "synced 4m ago." *"When the opposition says governance is failing, here's your sourced answer in seconds — and it never invents a number you can't defend."* → defence.
5. **Switch role: log in as Health Minister, then Collector.** The same clean skeleton re-scopes — statewide → one department → one district. *"Every level of your government has its own command room, pre-loaded with what to do."* → the relief/pride beat that wins the room.
6. **(If time) Click the Spine rail icon:** packets flow from CCTNS/HMIS/TNPDS into the very cockpit just shown; open the Data Access & Governance track. *"Today this is synthetic so you can see the whole government in one screen — but this is the exact pipeline, here's the 90-day pilot, and here's the part you do: grant access. We do everything else."* → converts "pretty demo" into "fundable programme."

---

## 7. WHAT THE PLANS GOT RIGHT (keep, don't touch)
The no-scroll six-zone contract discipline; **pendency-not-count** and **complaints-per-100k** as scale-invariant governance metrics (a CS respects these instantly); fail-closed role scoping (`allowed_departments`, derived-from-identity, 403 on empty); RAG-≠-brand-red and no-DEFCON aesthetic restraint; single deterministic-seed reproducibility. These are the parts that already read as "built by people who understand governance" — the seven credibility fixes protect this credible chassis from fabricated content sitting on top of it.

**Through-line:** the architecture is honest; make the *content* as honest as the architecture, and the same officials who would reject a naive draft will recognise this as the first governance tool built by people who respect how hard governing is.

---

## 8. FILE MAP (absolute paths the build agents touch)
- Layout shell + depth primitives: `...\dashboard\templates\dashboard\base.html` (`#aibrief`, `#lineage-modal`, `#cmdk`, `data-intro` gate, Band-1 controls, foot)
- Cockpit views: `...\dashboard\templates\dashboard\status_view.html` (Zones, 2-col stack), `...\district_view.html` (re-author `detail-grid`), `...\area_view.html`
- One-screen enforcement + zone CSS + tokens: `...\dashboard\static\dashboard\css\app.css` (shell `:60`, main grid `:413`, cards `:244`, status clamp `:1957`, one-screen `:1883`)
- Status/severity engine (single source of truth): `...\dashboard\thresholds.py` (`band_info`, `classify_status`, `rank_districts`; extend with works + scheme bands; do NOT overload `rank_districts` for improvement)
- API + scoping: `...\dashboard\api.py` (`_severity_sort_key`, `map_api`, `serialize_data_source`, `clamp_department`; new cockpit/guidance/proof/spine/recognition endpoints) · `...\dashboard\roles.py` (`allowed_departments`/`role_home_district` fail-closed; add `clamp_district`, `cockpit_archetype`, `allowed_schemes`; *propose* `dgp`/`superintendent_police`)
- Models + seed: `...\dashboard\models.py` (extend `DataSource`; add `PlaybookEntry`/`Officer`/`Directive`/`Incident`/`IncidentEvent`/`EscalationRule`/`Scheme*`/`Work*`/`Grievance`/`ProofMetric`/`RebuttalTopic`/`Milestone`/`TalkingPoint`/`OnboardingProgress`/`FieldSubmission`) · `...\dashboard\management\commands\seed_data.py` (deterministic `rng_for`; 6–8 depts; the rising red→green recognition arc)
- JS: `...\dashboard\static\dashboard\js\` — `fusion-center.js` (crawl/queue/combined), `dashboard.js` (`renderInsights`→`renderGuidance`, lineage packets), `command-palette.js`; new `i18n.js`, `onboarding.js`, `spine.js`, `brief.js`
- New: `...\dashboard\proof.py` · self-hosted Tamil OFL face in `...\dashboard\static\dashboard\vendor\fonts\` · `...\dashboard\static\dashboard\vendor\echarts\` (benchmark/charts)
