# Flexz P0-3: Guidance Engine And Incident Lifecycle Plan

Plain-language version. This plan explains the work without code snippets or exact edit instructions.

## Purpose

This plan gives the cockpit two active governing surfaces:

- Zone C: What Needs You Today, the recommended-action engine.
- Zone D: the incident lifecycle queue.

The goal is to turn the cockpit from a passive dashboard into a decision-support and action-recording system. A first-time leader should be able to see what matters, understand why it matters, issue a directive, and track an incident through a clear lifecycle.

## Main Outcomes

By the end of this plan:

- Zone C shows recommended actions ranked by severity and role scope.
- Each recommendation explains why the action matters.
- A user can open a directive composer and record an official directive.
- Directives become a diligence ledger, not a fake field-command system.
- Zone D shows live incident rows instead of the interim district list.
- Incidents move through a clear lifecycle: new, acknowledged, assigned, escalated, resolved.
- Every incident state change creates an audit event.
- The same focus-mode overlay is used for both guidance reviews and incident reviews.
- Role and district scoping remain fail-closed.

## Build Dependencies

This plan assumes Plan 1 and Plan 2 already exist.

From Plan 1, it needs:

- eight departments
- widened department fields
- role archetype helpers
- district clamp helper

From Plan 2, it needs:

- Zone C host
- Zone D host
- shared layout chassis
- rail event infrastructure

This plan creates the shared focus-mode primitive that Plan 4 later uses for Rapid Rebuttal.

## Guidance Engine

The Guidance Engine should answer a simple question: what should the leader do next?

It should inspect the worst current department and district situations inside the user's allowed scope. It should prefer red and amber issues and should avoid recommending something that already has an open directive.

Each recommendation should include:

- the department
- the district
- the current status
- the metric that triggered the recommendation
- the recommended first action
- a plain-English explanation
- the responsible officer role
- the related playbook entry

The explanation should feel like experienced administrative judgment, not generic analytics copy. It must not invent facts, comparisons, dates, or claims that are not present in the data.

## Playbook

The playbook is curated content. It should provide recommended action templates and why-this-matters text for each actionable department status.

The plan covers red and amber bands only. Green does not need a leader intervention.

Every department should have entries for red and amber. The strongest entries should carry non-obvious governance judgment, such as:

- possible suppression signals in policing
- wage-delay or fraud patterns in rural development
- tanker dependency traps in water supply
- DBT mismatch issues in social welfare
- dropout as a leading indicator in education
- surge capacity in health

The playbook should be seeded deterministically.

## Directive Ledger

A directive records that an authorized user acted on a recommendation.

It should store:

- district
- department
- issuing user and role
- assigned officer
- directive text
- why text
- deadline
- status
- linked playbook entry
- creation time

This is a diligence ledger. The wording in the product should make clear that Flexz records the directive and trail. It should not pretend to command field officers live.

## Incident Lifecycle

Zone D becomes an incident lifecycle queue.

Incidents are seeded from the same status bands used by the map, so the incident queue cannot disagree with the cockpit. Red and amber situations can become incidents. Green situations should not.

Each incident should include:

- code
- title
- department
- district
- detected status
- status value
- recommended first action
- reasoning
- lifecycle state
- assigned officer
- SLA hours
- detected time
- resolved time when closed

Each state transition should create an incident event, giving the product an append-only audit trail.

## Incident States

The lifecycle should be simple and legally ordered:

- new
- acknowledged
- assigned
- escalated
- resolved

Users should not be able to jump to arbitrary states. Invalid transitions should be rejected.

## Officers And Escalation

The plan adds named accountable officers as synthetic demo records. Officers provide a realistic destination for directives and incidents.

Escalation rules define where an issue goes next by department, role, and severity.

The demo should feel credible without pretending these are real personal records.

## API Behavior

The plan adds read and write API surfaces for guidance, directives, incidents, and incident transitions.

The guidance API should:

- return ranked recommendations
- respect department scope
- respect district scope
- suppress items with open directives
- return enough explanation and officer information for the UI

The directive API should:

- require authentication
- require CSRF protection
- reject out-of-scope districts
- coerce or reject departments according to the existing role rules
- create a directive record

The incident API should:

- return incidents inside the user's scope
- clamp department access
- clamp district access for district roles
- expose the lifecycle state and next action

The incident transition API should:

- require authentication and CSRF protection
- reject out-of-scope access
- allow only legal next states
- update the incident
- append an incident event

## Frontend Work

Zone C should render recommendation cards.

Each card should show:

- department and district
- RAG status
- the key metric
- recommended action
- why it matters
- buttons to review or issue a directive

The directive composer should open as a drawer. The user should be able to confirm the directive, after which the card flips to a directed state.

Zone D should render incident rows.

Each row should show:

- RAG chip with a word, not color alone
- SLA clock
- title
- district, department, state, and officer
- Review button
- next lifecycle action button

The review action should open the shared focus mode. The same focus mode must be reusable by later plans.

## Shared Focus Mode

This plan creates one shared full-screen focus primitive.

It should support:

- title
- eyebrow
- custom body content
- close behavior
- keyboard escape
- focus management
- reuse by guidance, incidents, and later Proof rebuttals

No plan should create a second bespoke review overlay if this shared one can serve the need.

## Test Plan

Automated tests should cover:

- Plan 1 substrate exists
- guidance models create and order correctly
- playbook coverage for all departments and actionable bands
- no green playbook entries
- no placeholder text in playbook entries
- directive creation and default status
- guidance API ranking
- guidance scope behavior
- open-directive suppression
- directive API authentication, CSRF, and clamp behavior
- incident models
- incident seeding from red and amber status
- incident deterministic seeding
- incident API scope behavior
- incident transition state machine
- incident event creation

## Implementation Sequence

1. Add substrate guard tests so the plan fails early if Plan 1 is missing.
2. Add Officer, PlaybookEntry, and Directive records.
3. Add the curated playbook.
4. Seed officers, playbook entries, and a sample directive.
5. Add guidance ranking and directive creation APIs.
6. Add the Zone C recommendation UI and directive composer.
7. Add the shared focus-mode overlay.
8. Add Incident, IncidentEvent, and EscalationRule records.
9. Seed incidents from existing banded metrics.
10. Add incident read and transition APIs.
11. Add the Zone D incident UI.
12. Run the full guidance and incident test suite.
13. Manually verify Zone C, directive creation, Zone D transitions, and focus review.

## Manual Verification

Guidance:

- Zone C shows recommended action cards.
- The top recommendation matches an actual red or amber condition.
- The why text is specific but not fabricated.
- Opening review uses the shared focus mode.
- Creating a directive records the action and flips the card state.

Incidents:

- Zone D shows incident rows, not the old district list.
- New incidents can be acknowledged in place.
- Acknowledged incidents expose the next legal action.
- Invalid state jumps are not possible from the UI.
- Review opens the shared focus mode.
- Escape closes the focus mode.

Scoping:

- A Health Minister only sees Health recommendations and incidents.
- A District Collector only sees their district.
- Forged district access is denied.

## Acceptance Criteria

This plan is complete when:

- Zone C is populated by the guidance API.
- Zone D is populated by the incident API.
- Directives can be created and stored.
- Incidents can be transitioned through the legal lifecycle.
- Incident events record each transition.
- The shared focus mode exists and is used by guidance and incidents.
- All role and district scoping tests pass.
- Seed data is deterministic.
- Full dashboard tests pass.
- System checks pass.

## Handoffs And Non-Goals

This plan does not build the Proof Engine. Plan 4 consumes the shared focus mode for Rapid Rebuttal.

This plan does not build the Data Spine. Plan 5 owns the Spine overlay and provenance work.

This plan does not build recognition or improvement-delta features. Those remain later work.

This plan does not claim live command-and-control. It records recommendations, directives, incident state, and diligence trail inside a synthetic demo.
