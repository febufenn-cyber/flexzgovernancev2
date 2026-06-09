# Flexz P0-5: Data Spine Mode, Governance Track, And Universal Provenance Plan

Plain-language version. This plan explains the work without code snippets or exact edit instructions.

## Purpose

This plan turns the product's source-system story into a full-screen Data Spine mode. It should show how department systems feed the platform, how data moves through ingestion into cockpits, and where data access is still pending.

It also makes provenance universal: every important number should be able to show where it came from.

The tone must be honest. The Data Spine should not look like a fake all-green architecture diagram. It should show live feeds, pilot feeds, and planned feeds with pending data-sharing or MoU work clearly named.

## Main Outcomes

By the end of this plan:

- The Spine rail icon opens a full Data Spine mode.
- Source systems are grouped into four acquisition tiers.
- Each source node shows freshness, latency, quality, onboarding status, and consent posture.
- The Spine view includes an ingestion-to-cockpit flow.
- The governance track names pending MoU and clearance work.
- A deterministic subset of sources is marked pilot or planned.
- CCTNS is explicitly shown as planned.
- Every key number gains a provenance trigger.
- The footer becomes an honesty ribbon with synthetic-data wording and a live "as of" time.
- Department-scoped users only see their department's sources.

## Build Dependencies

This is the last P0 plan. It assumes Plans 1 through 4 already exist.

From Plan 1, it needs:

- eight departments
- DataSource governance fields
- baseline DataSource seeding
- role scoping

From Plan 2, it needs:

- the left rail
- Spine rail placeholder
- rail mode event contract

From Plan 3, it benefits from the shared focus pattern but does not own it.

From Plan 4, it should not touch Proof or Rebuttal behavior.

This plan must not add new DataSource model fields or migrations. Plan 1 already owns those fields.

## Data Spine Concept

The Spine mode should show four acquisition tiers:

- API connectors
- Field officer apps
- Sensors or automated feeds
- Citizen-as-sensor feeds

Under those tiers, the view should show the platform path:

- source systems
- ingestion
- validation and common schema
- KPI and cockpit outputs

The view should feel like a credible statewide data architecture, not a decorative diagram.

## Governance Posture

Plan 1 baseline-seeds every data source as live. This plan curates that baseline into a more honest mix:

- some live
- some pilot
- some planned

At least two sources should be planned. The planned set must include Police CCTNS, because real access to that system would require serious governance clearance.

The curation should be deterministic and should not disturb telemetry values such as records today, latency, or last sync.

## Planned-Node Notes

Every planned node shown in the governance track should have an honest explanation of the access path.

Examples of the type of explanation expected:

- central or ministry clearance
- state-to-centre data-sharing MoU
- hardware rollout dependency
- telemetry SLA dependency
- DPDP or consent posture where relevant

The language should make clear that these are hard integration steps, not paperwork already solved.

## API Behavior

The existing data source serializer should be extended additively. Existing lineage API callers should keep receiving all old fields, plus the new governance fields.

The new Spine API should:

- require authentication
- respect allowed departments
- reject empty-scope roles
- optionally clamp to a requested department
- group source nodes by acquisition tier
- include governance counts for live, pilot, and planned
- include planned-node notes with MoU or clearance paths
- include source fields needed by the UI
- include an as-of timestamp

Department-scoped users should only see their department's sources.

## Universal Provenance

Every important number should have a source path.

The product already has a lineage modal. This plan extends usage so provenance chips can open the correct department's lineage from:

- KPI tiles
- map callouts
- detail metrics
- trend captions
- proof source chips where applicable

The lineage modal should remain the single provenance surface. This plan should not create a second lineage system.

## Band-4 Honesty Ribbon

The footer should become a fixed honesty ribbon.

It should communicate:

- this is synthetic demo data
- the architecture is designed for real government feeds
- the displayed time is the current as-of time in IST

The ribbon should be concise and should not expand the page height beyond the planned footer band.

## Frontend Work

The Spine mode should be a full-screen overlay opened from the left rail.

It should include:

- four tier columns
- source node cards
- onboarding status labels
- freshness and latency information
- quality indicators
- ingestion-to-cockpit flow row
- governance summary chips
- a governance slide-over or track for planned nodes
- close behavior through Escape, close button, or overlay close flow

Node status should use both color and words. Users should not need color alone to understand live, pilot, or planned.

The overlay may scroll internally if needed, but the home cockpit should remain one screen.

## Seed Work

The seed update should curate existing DataSource records rather than adding model fields.

It should:

- assign credible acquisition tiers to source nodes
- flip a deterministic subset to pilot or planned
- leave unspecified records live
- keep telemetry untouched
- keep output identical across repeated seed runs

This work should be static and deterministic, not random.

## Test Plan

Automated tests should cover:

- at least two planned nodes exist
- CCTNS is planned
- the onboarding mix contains live, pilot, and planned
- source nodes cover all four acquisition tiers
- seeding is identical across repeated runs
- telemetry values are not perturbed by curation
- lineage API keeps all original keys
- lineage API gains the governance fields
- Spine API returns tier groups
- Spine API returns governance counts and planned-node notes
- Spine API rejects empty-scope roles
- Spine API clamps department scope
- provenance changes do not break existing lineage behavior

## Implementation Sequence

1. Add seed tests for the curated governance posture.
2. Add static curation tables for acquisition tiers, onboarding status, and planned-node notes.
3. Add the seed step that updates DataSource governance posture after baseline seeding.
4. Extend the data source serializer additively.
5. Add regression tests proving lineage API remains compatible.
6. Add the Spine API and its route.
7. Add the Spine overlay shell to the base template.
8. Enable the Spine rail icon.
9. Add the Spine frontend behavior.
10. Add the Spine overlay styling.
11. Extend provenance triggers across key UI numbers.
12. Add the Band-4 honesty ribbon and live IST as-of time.
13. Run the full test suite and determinism check.
14. Manually verify statewide and department-scoped Spine views.

## Manual Verification

Statewide user:

- The Spine rail icon opens a full-screen overlay.
- The overlay shows four tier columns.
- API connectors are the largest group.
- Source nodes show live, pilot, or planned status as words.
- The header shows live, pilot, and planned counts.
- At least two nodes are planned.
- CCTNS appears as planned.
- The ingestion-to-cockpit flow is visible.
- The governance track lists planned nodes and their MoU or clearance paths.
- Escape closes the overlay and returns the rail to Cockpit.
- The home page still has no vertical scroll.

Department user:

- A Health Minister sees only Health source systems.
- Other departments do not leak into the Spine overlay.

Provenance:

- Clicking provenance on a key number opens the lineage modal.
- The modal opens for the correct department.
- Existing lineage behavior still works.

Honesty ribbon:

- The footer clearly states synthetic demo data.
- The as-of time appears in IST.
- The ribbon stays compact.

## Acceptance Criteria

This plan is complete when:

- Spine mode opens from the rail.
- Source systems are grouped into four acquisition tiers.
- Governance fields appear in lineage serialization without breaking old callers.
- The Spine API returns tiers, nodes, governance counts, and planned-node notes.
- The seed curation is deterministic.
- CCTNS is planned.
- The onboarding mix is not all live.
- Universal provenance works on key cockpit numbers.
- The honesty ribbon shows a live IST timestamp.
- Department scoping works.
- Full dashboard tests pass.
- System checks pass.
- Final determinism check passes.

## Handoffs And Non-Goals

This plan does not add DataSource fields or migrations. Plan 1 owns that.

This plan does not modify Proof, Rebuttal, Recognition, or Guidance behavior except where provenance chips need to open lineage.

This plan does not build a real external data integration. It presents the synthetic demo's intended pipeline and governance posture honestly.

This plan does not hide difficult access work. Pending MoUs and clearances are part of the product story.
