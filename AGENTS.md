# Project Codex Instructions

These instructions apply to this repository only. Global Codex workflow rules still apply; keep cross-repo defaults out of this file.

## Project Overview

- This is a small Vite + React 18 + TypeScript app for a COBE-powered interactive globe.
- Main app behavior lives in `src/App.tsx`.
- Global styling lives in `src/styles.css`.
- React mounts from `src/main.tsx`; Vite config lives in `vite.config.ts`.
- `dist/` is generated build output. Do not edit it directly.

## Local Commands

- `npm run dev` starts the Vite dev server.
- `npm run build` runs `tsc --noEmit` and then `vite build`. Use this as the primary verification command after code changes.
- `npm run preview` serves the built output from `dist/`.
- There are currently no lint or test scripts. Do not claim lint or test coverage unless those scripts are added and run.

## Implementation Notes

- Keep changes narrow. This project has one primary UI surface, so avoid broad refactors unless the user asks for them.
- Preserve the existing split between React state for rendered labels and refs for animation-loop state.
- Keep COBE integration inside the canvas lifecycle in `src/App.tsx`; create and destroy the globe from React effects.
- When changing globe math or marker behavior, check drag rotation, visible marker selection, arc animation, resize behavior, and `prefers-reduced-motion`.
- Keep marker data structured with stable `id`, `label`, `location`, `size`, and optional `labelOffset` fields.
- Match the existing strict TypeScript style. Prefer explicit tuple types and local helper types where they clarify globe coordinates or COBE API values.
- Keep CSS in `src/styles.css` unless a larger component split is requested. Maintain stable dimensions for the canvas/stage so labels, hover/drag state, and responsive sizing do not shift unexpectedly.

## Visual And Interaction Checks

- For visual changes, run `npm run dev` and inspect the page in a browser, not just the build output.
- Verify the canvas is nonblank, centered, and correctly sized on desktop and mobile widths.
- Verify dragging rotates the globe and does not select page text or scroll the viewport.
- Verify city labels remain legible and do not overlap incoherently at the tested viewport sizes.
- If animation, pulsing, or arc drawing changes, also check behavior with reduced motion where practical.

## Dependency Changes

- Update `package-lock.json` whenever `package.json` dependencies change.
- Prefer existing dependencies (`react`, `react-dom`, `cobe`, Vite, TypeScript) before adding new packages.
- Do not introduce a routing, state management, UI, or styling framework for small local changes.
