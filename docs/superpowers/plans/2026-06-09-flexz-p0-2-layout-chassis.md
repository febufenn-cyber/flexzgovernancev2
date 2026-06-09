# Flexz P0-2: Layout Chassis Plan

Plain-language version. This plan explains the work without code snippets or exact edit instructions.

## Purpose

This plan builds the main cockpit shell that every later feature uses. It turns the dashboard into a one-screen command room with a left rail, clear mode switching, and a layout that adapts to statewide, department, and district users.

It does not build the final Guidance, Proof, or Data Spine content. It creates the places those features will live and makes sure the product has a stable navigation and layout skeleton.

## Main Outcomes

By the end of this plan:

- A left icon rail is visible across the cockpit.
- The rail has Cockpit, Proof, Spine, and Help entries.
- Cockpit is active immediately.
- Proof, Spine, and Help are visible but disabled until their owning plans make them live.
- The statewide cockpit uses a two-column situation-room layout.
- Department and district cockpits use a three-column layout.
- Zone C and Zone D have real hosts so later plans can fill them.
- Infinite blink, pulse, and marquee animations are removed.
- The department tab row can handle the eight-department expansion.

## Layout Shape

The product should keep a one-screen feel. The rail is a left-side control surface and should not add vertical height.

The statewide cockpit should read as:

- Zone A: KPI strip above the main map area
- Zone B: map and department tabs
- Zone C: guidance host
- Zone D: incident or priority host
- left rail: mode switcher

For statewide users, the map sits on the left and Zones C and D stack on the right.

For department and district users, the same content skeleton shifts into three columns so Zones C and D each have their own column.

## Role Archetypes

The page layout is driven by a role archetype:

- statewide
- department
- district

The backend should place this archetype on the body element so CSS can choose the correct layout. This is only a layout hint. Security remains controlled by the existing role and department scoping.

If a role is unclear, the page may render in the statewide shape, but the data layer must still fail closed.

## Left Rail

The rail is the main mode switcher.

It should show:

- Cockpit
- Proof
- Spine
- Help

Cockpit should behave as the normal home mode. The other entries are placeholders until their feature plans land.

The rail also needs a small event producer so later plans can open Proof and Spine modes without rebuilding the rail.

## Zone Ownership

This plan owns the containers, not the final business logic.

Zone C is the Guidance host. Plan 3 fills it.

Zone D is the Incident host. Plan 3 replaces the interim district list with the incident lifecycle queue.

The Proof tile host must exist so Plan 4 can render the proof tile into the KPI strip.

The Spine mode is opened from the rail later by Plan 5.

## Motion Cleanup

The dashboard should feel calm. This plan removes the distracting forever-loop animations named by the blueprint:

- priority district blinking
- worst ward blinking
- alert list marquee scrolling

Priority and worst items should still be visible, but with static accents instead of motion.

The Band 0 alert crawl is intentionally left alone because it is a sanctioned top-band element.

## Department Tabs

Plan 1 expands the product to eight departments. This plan makes the tab row able to fit that larger set plus the Combined tab.

The tab row should stay inside the one-screen layout. It can become more compact, but it should not create a new vertical band or force the page to scroll.

## Test Plan

Automated tests should prove that:

- the body includes the correct archetype for key roles
- the Chief Minister sees the statewide archetype
- a minister sees the department archetype
- a district collector sees the district archetype
- the district collector's home district is present on the page
- scoped users only see the tabs they are allowed to see

Manual verification should confirm that the visual layout behaves correctly across the three archetypes.

## Implementation Sequence

1. Confirm the role archetype helper from Plan 1 exists.
2. Add the archetype value to the shared dashboard context.
3. Place the archetype on the body element.
4. Add a left rail to the base layout.
5. Add the small rail event script for future modes.
6. Split the right-side status panel into Zone C and Zone D hosts.
7. Add proof hosts to district and area views so later proof work has a place to render.
8. Add CSS for the rail, the two-column statewide layout, and the three-column department and district layout.
9. Remove the forever-loop motion effects and replace them with static accents.
10. Adjust the department tab layout for eight departments plus Combined.
11. Run checks and visually verify the three archetypes.

## Manual Verification

Statewide user:

- The body reports the statewide archetype.
- The cockpit has two columns.
- The map is the dominant left area.
- Zones C and D stack on the right.
- The left rail is visible with Cockpit active.
- Priority districts use a static gold outline and do not blink.
- The page fits at a normal desktop size without vertical scrolling.

Department user:

- The body reports the department archetype.
- The cockpit becomes three columns.
- Only the user's allowed department tab appears.
- Combined does not appear when there is only one allowed department.
- The page still fits without vertical scrolling.

District user:

- The body reports the district archetype.
- The home district is present on the body.
- The cockpit uses the same three-column structure.
- The home district ring and priority district accent are both static.
- District and area views also show the rail and remain usable.

## Acceptance Criteria

This plan is complete when:

- The left rail exists and does not consume vertical page height.
- The rail can dispatch future mode selections.
- The statewide cockpit is a two-column situation room.
- Department and district cockpits are three-column layouts.
- Zone C and Zone D hosts exist and are clearly labeled.
- The interim Zone D list still provides useful content until Plan 3 replaces it.
- The proof host exists for Plan 4.
- The named forever-loop animations are gone.
- The expanded department tab row fits the one-screen layout.
- Automated chassis tests pass.
- System checks pass.
- Manual verification is recorded.

## Handoffs And Non-Goals

This plan does not build the Guidance Engine, Incident lifecycle, Proof Engine, or Data Spine. It only creates the shell they need.

This plan does not build new scoring, endpoints, or governance logic.

This plan does not create bespoke role-specific hero content. It only switches the shared skeleton between statewide, department, and district layouts.
