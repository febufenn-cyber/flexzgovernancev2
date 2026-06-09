# Flexz P0-4: Proof Engine And Rapid Rebuttal Plan

Plain-language version. This plan explains the work without code snippets or exact edit instructions.

## Purpose

This plan gives Flexz a defensive proof layer. The cockpit should not only show current problems; it should also show what the government can credibly prove from its own operational data.

The Proof Engine has three parts:

- an always-visible Proof tile in the KPI strip
- a full Proof mode opened from the tile or left rail
- a Rapid Rebuttal focus view for answering attacks with sourced internal data

The central rule is honesty. The proof layer must use this government's own operational feeds only. It must not compare against previous administrations, other states, or national averages.

## Main Outcomes

By the end of this plan:

- The KPI strip has a Proof tile.
- The Proof tile opens a full Proof mode.
- The Proof rail icon becomes active.
- Proof mode shows delivery against target.
- Proof mode shows a Rapid Rebuttal deck.
- Proof mode shows a recent milestone timeline.
- Every proof figure carries a source code.
- Rapid Rebuttal uses the shared focus mode from Plan 3.
- All rebuttal content is watermarked as an internal synthetic demo draft.
- Department-scoped users only see their department's proof content.

## Build Dependencies

This plan assumes Plans 1, 2, and 3 already exist.

From Plan 1, it needs:

- eight departments
- department scope helpers
- widened department fields

From Plan 2, it needs:

- the left rail
- Proof rail placeholder
- KPI strip host
- rail mode event contract

From Plan 3, it needs:

- the shared focus-mode overlay
- the global focus opener used by Rapid Rebuttal

This plan should not create another rebuttal overlay. It must consume the shared focus primitive.

## Proof Content

The plan adds three read-only proof content types:

- Proof metrics
- Rebuttal topics
- Milestones

Proof metrics show delivery against a target. They should include:

- department
- label
- reached value
- target value
- unit
- proof kind
- freshness
- sort order
- source code

Rebuttal topics show likely attacks and defensible counters. They should include:

- department
- attack line
- counter line
- source code
- whether it is the softest topic
- sort order

Milestones show recent achievements. They should include:

- optional department
- title
- detail
- days ago
- sort order

## Proof Banding

Proof uses its own attainment scale. It mirrors the shape of a normal status response but does not reuse the cockpit's governance thresholds.

The basic idea:

- at or above target is green
- clearly on the way is amber
- behind target is red

The UI should use normal status colors. It should not use the political brand red as a proof status.

## Watermark And Honesty Rules

Every Rapid Rebuttal and proof export-style view should carry the exact honesty message:

INTERNAL DRAFT - synthetic demo data - not for public release

The rebuttal content must avoid:

- previous administration comparisons
- other-state comparisons
- national-average comparisons
- rankings
- fabricated public claims

The point is to show that the government can answer from its own data, not to invent a campaign document.

## Proof API Behavior

The proof API should:

- require authentication
- respect allowed departments
- return proof metrics inside scope
- include source codes
- include proof banding
- return milestones relevant to the user's scope
- return a 403 response if the role has no department access

The rebuttal API should:

- require authentication
- respect allowed departments
- return rebuttal topics inside scope
- identify the softest topic
- include the watermark
- include source codes
- reject empty-scope access

## Frontend Work

The Proof tile should sit in the KPI strip as the fourth cell. It should be compact, not a tall card.

The tile should show:

- "Our Record"
- the related department
- an attainment percentage
- a short metric label
- a visual cue that it opens the Proof mode

Proof mode should be a full-screen overlay with:

- a delivery-vs-target proof card area
- a Rapid Rebuttal deck
- a milestone timeline
- a watermark banner
- source chips on metrics
- close behavior through Escape, close button, or overlay close flow

Rapid Rebuttal should open inside Plan 3's shared focus mode. It should show:

- the attack line
- the answer from own data
- source code
- watermark

## Rail Behavior

Plan 2 creates the Proof rail icon as disabled. This plan enables it.

Clicking Proof in the rail should open Proof mode. Closing Proof mode should return the rail to Cockpit.

The Proof tile should open the same Proof mode as the rail icon.

## Seeding

The seed command should create deterministic proof metrics, rebuttal topics, and milestones.

The seeded content should be credible and conservative:

- one proof metric per department
- one rebuttal topic per department
- one softest topic flagged in the current scope
- a small milestone timeline
- source codes populated everywhere they are needed

The seed must stay deterministic across runs.

## Test Plan

Automated tests should cover:

- proof model fields and defaults
- source code on proof metrics
- proof band thresholds and return shape
- safe behavior for zero targets
- rebuttal pack scoping
- watermark exactness
- banned comparison phrases are absent
- one softest topic is flagged
- proof API authentication and scoping
- rebuttal API authentication and scoping
- source codes are present
- seed determinism
- seeded rebuttal content follows honesty rules

## Implementation Sequence

1. Add proof content models.
2. Generate and apply the proof migration.
3. Add the proof-band helper.
4. Add the rebuttal pack helper and watermark.
5. Seed proof metrics, rebuttal topics, and milestones.
6. Add proof and rebuttal APIs.
7. Add the Proof tile and Proof mode frontend behavior.
8. Add the Proof mode overlay shell.
9. Enable the Proof rail icon.
10. Add Proof Engine styling.
11. Run the full proof test suite.
12. Manually verify the tile, mode, rebuttal focus, and scope behavior.

## Manual Verification

Statewide user:

- The KPI strip shows a compact Proof tile.
- The tile displays an attainment percentage.
- Clicking the tile opens Proof mode.
- The Proof rail icon also opens the same mode.
- Proof mode shows delivery cards, rebuttal deck, and milestone timeline.
- The watermark is visible.
- Source chips are visible.
- Closing the overlay returns the rail to Cockpit.

Rapid Rebuttal:

- Clicking a rebuttal row opens the shared focus mode.
- The focus view shows the attack, the own-data answer, source code, and watermark.
- It does not mention previous administrations, other states, rankings, or national averages.

Department user:

- A Health Minister only sees Health proof metrics and rebuttals.
- No other department content leaks into the proof view.

## Acceptance Criteria

This plan is complete when:

- The Proof tile renders in the KPI strip.
- Proof mode opens from both tile and rail.
- Proof mode includes delivery, rebuttal, and milestone sections.
- Rapid Rebuttal uses the shared Plan 3 focus primitive.
- All proof and rebuttal content carries source codes.
- The watermark appears exactly where required.
- Banned comparison language is absent.
- Scope clamping works for department users.
- Seed data is deterministic.
- All proof tests pass.
- Full dashboard tests pass.
- System checks pass.

## Handoffs And Non-Goals

This plan does not build the Data Spine. Plan 5 owns Spine mode and universal provenance.

This plan does not build recognition or improvement-delta features.

This plan does not create public export documents. It creates a watermarked internal draft view suitable for demo and review.

This plan does not create a new focus overlay. It uses the shared one from Plan 3.
