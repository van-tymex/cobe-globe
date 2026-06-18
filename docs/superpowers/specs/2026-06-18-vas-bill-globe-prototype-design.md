# VAS Bill Globe Prototype Design

## Context

Build the selected Figma screen, `10 VAS Bill UI 2.0 MASTER` node `13833:7339`, as a mobile-first prototype in this Vite + React app. The repo already contains a working COBE globe experiment with draggable rotation, location labels, active destination selection, arc animation, resizing, and reduced-motion handling.

## Goal

Create a 375px mobile app-screen prototype centered on desktop that matches the selected Figma screen, while preserving the existing interactive COBE globe as the live globe in the screen's globe area.

## Scope

- Match the visible screen structure from Figma: iOS status bar, top navigation, eSIM pill, title, subtitle, globe area, destination search card, banner card, benefits list, FAQ list, and home indicator.
- Keep the UI static except for the globe. Search, destination flags, banner action, benefits, and FAQ rows are presentational prototype elements.
- Use the current destination set already represented by the globe: Taiwan, Australia, HongKong, and Japan.
- Keep implementation local to `src/App.tsx` and `src/styles.css`, plus small local assets only when needed to match Figma icons, flags, or status-bar artwork.
- Do not edit generated `dist/`.

## Non-Goals

- No routing, API integration, real search behavior, plan purchase flow, FAQ expansion, or state management library.
- No dependency additions.
- No replacement of the COBE globe with a static Figma bitmap.

## Proposed Architecture

`src/App.tsx` remains the main surface. The existing `CobeGlobe` component continues to own the canvas lifecycle, animation refs, marker data, drag handling, and label rendering. The page shell around it becomes a Figma-inspired mobile screen composed from local arrays and small render helpers for:

- popular destinations,
- benefit rows,
- FAQ rows,
- simple icon/flag presentation.

`src/styles.css` defines the prototype frame, screen gradient, typography, cards, navigation bars, destination chips, list rows, and the globe viewport. The globe stage is resized and clipped to sit behind the destination card, matching the Figma composition where the globe is partially visible above the card. If exact Figma visual details require assets, use local files derived from the Figma MCP asset data rather than adding packages.

## Visual Requirements

- The app renders as a 375px-wide mobile screen centered in the browser on desktop.
- The first viewport resembles the Figma screenshot: pale blue key-screen background, compact navigation, centered title block, globe behind the active destination card, white rounded cards, and dark text.
- The destination card overlaps the globe area, with search and popular destination choices visible.
- Text must not overlap incoherently at mobile or desktop viewport sizes.
- The globe canvas must remain nonblank, centered in its slot, and visibly integrated with the screen.

## Interaction Requirements

- Dragging the globe rotates it and does not select page text or scroll the viewport.
- Active destination labels and the arc animation continue to work.
- `prefers-reduced-motion` keeps motion reduced for label and arc behavior.
- Non-globe UI elements can look tappable but do not need click behavior for this prototype.

## Data Requirements

Keep marker data structured with stable `id`, `label`, `location`, `size`, and optional `labelOffset`. Use matching display labels in the UI:

- Taiwan, suggested
- Australia
- HongKong
- Japan

Benefit rows should match the Figma text:

- 1 eSIM / For 195 Countries
- Fastest network / Wherever you go
- Top up anytime / Even when you have no data
- Instant activation / Manage in-app
- Earn points / For every transaction

FAQ rows should match the Figma text:

- How to use?
- How can I activate?
- How does eSIM work?
- Can I have more than one eSIM?

## Verification

Run `npm run build` after implementation. Then run `npm run dev` and inspect the page in a browser at mobile and desktop widths, checking:

- mobile screen is centered and visually matches the Figma structure,
- globe canvas is nonblank and correctly sized,
- dragging rotates the globe without page text selection,
- city labels remain legible and do not overlap incoherently,
- destination card overlap and lower cards stay readable,
- reduced-motion behavior is still acceptable where practical.
