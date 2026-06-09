# Flexz P0-1: Department Breadth Plan

Plain-language version. This plan explains the work without code snippets or exact edit instructions.

## Purpose

Flexz currently treats governance as a three-department cockpit: Police, Health, and PDS. This plan expands the product to eight departments by adding Revenue, Rural Development, Social Welfare, Water, and Education.

The important promise is that the existing three departments must not change. Police, Health, and PDS data, scoring, seed values, and visual behavior should remain exactly as they were before the expansion.

## Departments Covered

The final department set is:

- Police
- Health
- PDS
- Revenue
- Rural Development
- Social Welfare
- Water
- Education

This same order should be used everywhere in the product so the UI, APIs, seed data, tests, and dashboards all agree.

## Main Outcomes

By the end of this plan:

- Every department appears in the cockpit tabs.
- Every department has a clear primary metric.
- Every department has a fair governance rate, not a raw headline count.
- The API works for every department.
- Demo data seeds for every department.
- Role scoping still works and fails closed.
- Existing Police, Health, and PDS values remain unchanged.
- Data source records include the extra governance fields needed by the later Data Spine plan.

## Metric Philosophy

The new departments must be scored using scale-aware governance rates. A large district should not look bad just because it is large.

Each new department uses a rate or percentage:

- Revenue: applications pending past SLA
- Rural Development: MGNREGA wage payments delayed
- Social Welfare: pension DBT failures
- Water: habitations below supply norms
- Education: student dropout rate

The existing banding system remains the single authority for green, amber, and red status.

## Data Model Work

The department field needs to support the longer department name `social_welfare`. Any model that stores a department value must be widened consistently.

The DataSource model also gains the governance fields needed for the Data Spine:

- acquisition tier
- system owner
- connector type
- quality score
- consent basis
- onboarding status
- districts reporting

These fields are owned by this plan because later plans depend on them. The Data Spine plan will curate and display them, but it should not add more model fields.

## Seed Data Work

The seed command must create district and ward metrics for all eight departments.

The key rule is determinism. Adding new department data must not disturb the random sequence already used for Police, Health, or PDS. The new departments should use isolated deterministic streams so the old values remain byte-identical.

The lineage graph also expands from three departments to eight. Each department should have credible source systems, ingestion nodes, and KPI/cockpit outputs.

DataSource governance fields should be baseline-filled for every node. At this stage, all nodes can start as live. The later Data Spine plan will change selected nodes to pilot or planned.

## Role And Scope Work

This plan adds the shared role helpers needed by later plans:

- a helper that maps a role to statewide, department, or district cockpit archetype
- a helper that denies forged district access
- a helper that reads the current request archetype

Department scoping keeps the existing behavior: an out-of-scope requested department is coerced back to something the user is allowed to see. District scoping is stricter: forged district access is denied.

## API Work

The API must understand all eight departments.

This includes:

- KPI item definitions
- metric tiles
- district summaries
- per-department responses
- role-scoped behavior

The PDS fallback branch should become an explicit PDS branch so new departments cannot accidentally fall into it.

## Frontend Work

All hardcoded department metadata must be expanded:

- dashboard department metadata
- fusion center metadata
- command palette metadata
- command palette department actions
- fallback allowed-department strings

The three cockpit templates also need tabs for the five new departments:

- statewide status view
- district view
- area view

The base template fallback must include all eight departments.

## Test Plan

The tests should prove four things:

- The original three departments did not drift.
- All eight departments have config, thresholds, seed data, and valid status bands.
- Every relevant endpoint works for every department.
- Role scoping still prevents users from seeing data outside their authority.

The most important test is the characterization test for Police, Health, and PDS. It should capture their existing payloads before any expansion work and continue passing after the expansion.

## Implementation Sequence

1. Capture and protect the existing Police, Health, and PDS seed values.
2. Add the five new departments to the shared department list, threshold config, and canonical department order.
3. Add the DataSource governance fields and generate the migration.
4. Add deterministic seed data for the five new departments.
5. Expand the lineage graph and baseline governance field seeding.
6. Add the role helper functions.
7. Expand the API responses for all eight departments.
8. Expand JavaScript metadata, command palette actions, and template tabs.
9. Reseed and verify counts.
10. Run the full regression suite and confirm no pending migrations.

## Acceptance Criteria

This plan is complete when:

- The product recognizes exactly eight departments.
- District metrics equal number of districts times eight.
- Ward metrics equal number of districts times wards per district times eight.
- Lineage source counts scale to all eight departments.
- The original three departments match their captured golden values.
- Every new department returns valid API data and a valid status band.
- The statewide cockpit shows all eight tabs plus Combined for a statewide user.
- A department-scoped user only sees their department.
- A district-scoped user cannot forge another district.
- Django checks pass.
- The migration fully represents the model changes.

## Handoffs And Non-Goals

This plan does not redesign the layout. If the tab row becomes visually crowded, only a minimal overflow or fit fix should be added. The larger layout work belongs to the Layout Chassis plan.

Some Combined-view copy may still mention only the original three departments. That is a known handoff to the layout and fusion work, not part of this department-breadth plan.

Plan 5 will later curate DataSource onboarding statuses into live, pilot, and planned. This plan only creates and baseline-fills the fields.
