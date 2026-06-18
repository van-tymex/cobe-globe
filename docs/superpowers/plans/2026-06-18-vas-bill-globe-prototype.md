# VAS Bill Globe Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the selected Figma VAS Bill eSIM intro screen as a centered 375px mobile prototype while preserving the existing interactive COBE globe.

**Architecture:** Keep the COBE lifecycle and globe math in `src/App.tsx`. Add a static mobile-screen shell around the existing globe using local data arrays and render helpers. Use `src/styles.css` for the full Figma-inspired visual treatment and `src/assets/figma/` for MCP-derived decorative assets.

**Tech Stack:** Vite, React 18, TypeScript, CSS, COBE, local image assets.

---

## Source Inputs

- Spec: `docs/superpowers/specs/2026-06-18-vas-bill-globe-prototype-design.md`
- Figma file: `R14sRnFU06RrajR6cGobap`
- Figma node: `13833:7339`
- Current app behavior: `src/App.tsx`
- Current global styles: `src/styles.css`

## File Structure

- Create `src/assets/figma/`: local decorative icons and flags downloaded from Figma MCP asset URLs.
- Create `src/vite-env.d.ts`: Vite asset import declarations for SVG and PNG modules.
- Modify `src/App.tsx`: import local assets, keep existing globe logic, add static prototype data and screen sections.
- Modify `src/styles.css`: replace the current globe-only page styling with a centered mobile screen, card/list styling, destination flag styling, and resized globe styling.
- No test files are added because this repo has no test runner. Verification is `npm run build` plus browser inspection.

---

### Task 1: Add Figma MCP Assets

**Files:**
- Create: `src/vite-env.d.ts`
- Create: `src/assets/figma/arrow-left.svg`
- Create: `src/assets/figma/help.svg`
- Create: `src/assets/figma/search.svg`
- Create: `src/assets/figma/chevron-right.svg`
- Create: `src/assets/figma/status.svg`
- Create: `src/assets/figma/flag-taiwan.png`
- Create: `src/assets/figma/flag-australia.png`
- Create: `src/assets/figma/flag-hong-kong.png`
- Create: `src/assets/figma/icon-globe.svg`
- Create: `src/assets/figma/icon-electricity.svg`
- Create: `src/assets/figma/icon-clock.svg`
- Create: `src/assets/figma/icon-instant.svg`
- Create: `src/assets/figma/icon-favorite.svg`

- [ ] **Step 1: Create the asset directory**

Run:

```bash
mkdir -p src/assets/figma
```

Expected: command exits with code 0.

- [ ] **Step 2: Download decorative assets from the Figma MCP URLs**

Run:

```bash
curl -L "https://www.figma.com/api/mcp/asset/bffa3793-8a51-4abb-9425-7c87e1ff6723" -o src/assets/figma/arrow-left.svg
curl -L "https://www.figma.com/api/mcp/asset/99e0dc38-2114-4a30-bc93-60cc072c33a8" -o src/assets/figma/help.svg
curl -L "https://www.figma.com/api/mcp/asset/46144688-c40b-4d58-9429-b18c6ea5cf5e" -o src/assets/figma/search.svg
curl -L "https://www.figma.com/api/mcp/asset/e12dabd4-0905-4c3f-b273-b33b96cf15ba" -o src/assets/figma/chevron-right.svg
curl -L "https://www.figma.com/api/mcp/asset/6376066e-6637-4419-a5f3-1fc8efa7c673" -o src/assets/figma/status.svg
curl -L "https://www.figma.com/api/mcp/asset/6e03f48e-d5f6-41f3-8b4f-2f71b204245c" -o src/assets/figma/flag-taiwan.png
curl -L "https://www.figma.com/api/mcp/asset/badb269d-b1ae-4202-a60c-dcdc65d6c1f5" -o src/assets/figma/flag-australia.png
curl -L "https://www.figma.com/api/mcp/asset/7224cf25-ecfd-4ec9-a740-6e08b7f1b5fe" -o src/assets/figma/flag-hong-kong.png
curl -L "https://www.figma.com/api/mcp/asset/c6538d2b-32de-4ba8-8fdb-1e72d6266c98" -o src/assets/figma/icon-globe.svg
curl -L "https://www.figma.com/api/mcp/asset/1787d798-a10f-4bab-a019-89821062040d" -o src/assets/figma/icon-electricity.svg
curl -L "https://www.figma.com/api/mcp/asset/fc32a122-87d1-401d-9655-5290795336db" -o src/assets/figma/icon-clock.svg
curl -L "https://www.figma.com/api/mcp/asset/f9fb50cd-2801-450b-85ca-7ff02ac6b321" -o src/assets/figma/icon-instant.svg
curl -L "https://www.figma.com/api/mcp/asset/f9f580b6-9837-4934-b8d8-69bd7fc0d6bf" -o src/assets/figma/icon-favorite.svg
```

Expected: each `curl` command exits with code 0 and writes one file.

- [ ] **Step 3: Confirm the asset list**

Run:

```bash
ls -1 src/assets/figma
```

Expected output:

```text
arrow-left.svg
chevron-right.svg
flag-australia.png
flag-hong-kong.png
flag-taiwan.png
help.svg
icon-clock.svg
icon-electricity.svg
icon-favorite.svg
icon-globe.svg
icon-instant.svg
search.svg
status.svg
```

- [ ] **Step 4: Add Vite asset import declarations**

Create `src/vite-env.d.ts` with this complete content:

```ts
/// <reference types="vite/client" />
```

Expected: TypeScript can resolve local SVG and PNG imports through Vite's client type declarations.

- [ ] **Step 5: Commit the assets and declarations**

Run:

```bash
git add src/assets/figma src/vite-env.d.ts
git commit -m "chore: add figma prototype assets"
```

Expected: commit succeeds and includes only files in `src/assets/figma/` plus `src/vite-env.d.ts`.

---

### Task 2: Build the Mobile Screen Structure

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add local asset imports below the COBE import**

Add:

```tsx
import arrowLeftIcon from "./assets/figma/arrow-left.svg";
import chevronRightIcon from "./assets/figma/chevron-right.svg";
import flagAustralia from "./assets/figma/flag-australia.png";
import flagHongKong from "./assets/figma/flag-hong-kong.png";
import flagTaiwan from "./assets/figma/flag-taiwan.png";
import helpIcon from "./assets/figma/help.svg";
import iconClock from "./assets/figma/icon-clock.svg";
import iconElectricity from "./assets/figma/icon-electricity.svg";
import iconFavorite from "./assets/figma/icon-favorite.svg";
import iconGlobe from "./assets/figma/icon-globe.svg";
import iconInstant from "./assets/figma/icon-instant.svg";
import searchIcon from "./assets/figma/search.svg";
import statusIcon from "./assets/figma/status.svg";
```

- [ ] **Step 2: Add prototype data below `INITIAL_DESTINATION_SELECTION`**

Add:

```tsx
type DestinationOption = {
  id: string;
  label: string;
  suggested?: boolean;
  flagImage?: string;
  flagClassName?: string;
};

type InfoRow = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

const DESTINATION_OPTIONS: DestinationOption[] = [
  { id: "taiwan", label: "Taiwan", suggested: true, flagImage: flagTaiwan },
  { id: "australia", label: "Australia", flagImage: flagAustralia },
  { id: "hong-kong", label: "HongKong", flagImage: flagHongKong },
  { id: "japan", label: "Japan", flagClassName: "flag-japan" },
];

const BENEFIT_ITEMS: InfoRow[] = [
  { id: "esim", icon: iconGlobe, title: "1 eSIM", description: "For 195 Countries" },
  { id: "network", icon: iconElectricity, title: "Fastest network", description: "Wherever you go" },
  { id: "top-up", icon: iconClock, title: "Top up anytime", description: "Even when you have no data" },
  { id: "activation", icon: iconInstant, title: "Instant activation", description: "Manage in-app" },
  { id: "points", icon: iconFavorite, title: "Earn points", description: "For every transaction" },
];

const FAQ_ITEMS = [
  "How to use?",
  "How can I activate?",
  "How does eSIM work?",
  "Can I have more than one eSIM?",
];
```

- [ ] **Step 3: Add presentational helpers above `export default function App`**

Add:

```tsx
function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span className="status-bar-time">9:41</span>
      <img className="status-bar-levels" src={statusIcon} alt="" />
    </div>
  );
}

function TopNavigation() {
  return (
    <nav className="top-navigation" aria-label="Prototype navigation">
      <button className="icon-button" type="button" aria-label="Go back">
        <img src={arrowLeftIcon} alt="" />
      </button>
      <button className="icon-button" type="button" aria-label="Help">
        <img src={helpIcon} alt="" />
      </button>
    </nav>
  );
}

function DestinationFlag({ option }: { option: DestinationOption }) {
  return (
    <div className="destination-option">
      <div className="flag-frame">
        {option.flagImage ? (
          <img className="flag-image" src={option.flagImage} alt="" />
        ) : (
          <span className={`css-flag ${option.flagClassName ?? ""}`} aria-hidden="true" />
        )}
        {option.suggested ? <span className="suggested-badge">Suggested</span> : null}
      </div>
      <span>{option.label}</span>
    </div>
  );
}

function DestinationCard() {
  return (
    <section className="card destination-card" aria-labelledby="destination-heading">
      <div className="card-heading" id="destination-heading">Where?</div>
      <div className="search-field" aria-label="Search your destination">
        <img src={searchIcon} alt="" />
        <span>Search your destination</span>
      </div>
      <div className="popular-label">Popular destinations</div>
      <div className="destination-row">
        {DESTINATION_OPTIONS.map((option) => (
          <DestinationFlag key={option.id} option={option} />
        ))}
      </div>
    </section>
  );
}

function BannerCard() {
  return (
    <section className="card banner-card">
      <h2>Buy eSIM for your friends and family</h2>
      <p>Buy and share eSIMs in just a few simple steps, so family and friends stay connected wherever they go.</p>
      <button className="primary-button" type="button">Buy now</button>
    </section>
  );
}

function BenefitsCard() {
  return (
    <section className="content-group" aria-labelledby="benefits-heading">
      <h2 className="section-title" id="benefits-heading">Benefits</h2>
      <div className="list-card">
        {BENEFIT_ITEMS.map((item) => (
          <div className="info-row" key={item.id}>
            <img className="info-row-icon" src={item.icon} alt="" />
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqCard() {
  return (
    <section className="content-group" aria-labelledby="faq-heading">
      <h2 className="section-title" id="faq-heading">FAQs</h2>
      <div className="list-card faq-card">
        {FAQ_ITEMS.map((item) => (
          <button className="faq-row" key={item} type="button">
            <span>{item}</span>
            <img src={chevronRightIcon} alt="" />
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace the current `App` return with the full prototype screen**

Replace:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <CobeGlobe />
    </main>
  );
}
```

With:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="phone-screen" aria-label="eSIM travel intro prototype">
        <StatusBar />
        <TopNavigation />

        <div className="screen-content">
          <header className="intro-header">
            <span className="eyebrow">eSIM</span>
            <h1>Travel around the world</h1>
            <p>Welcome to Taiwan</p>
          </header>

          <div className="thin-divider" aria-hidden="true" />

          <div className="globe-composition">
            <div className="globe-window">
              <CobeGlobe />
            </div>
            <DestinationCard />
          </div>

          <BannerCard />
          <BenefitsCard />
          <FaqCard />
        </div>

        <div className="home-indicator" aria-hidden="true" />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Run the TypeScript and Vite build**

Run:

```bash
npm run build
```

Expected: `tsc --noEmit` succeeds and Vite completes the production build.

- [ ] **Step 6: Commit the screen structure**

Run:

```bash
git add src/App.tsx
git commit -m "feat: add vas bill prototype screen structure"
```

Expected: commit succeeds and includes only `src/App.tsx`.

---

### Task 3: Match the Figma Visual Treatment

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Replace `src/styles.css` with the mobile prototype styles**

Use this complete file content:

```css
:root {
  color: #2d2d3a;
  background: #edf3f4;
  font-family:
    "SF Pro",
    "SF Pro Text",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
  margin: 0;
}

body {
  min-width: 320px;
  overflow: auto;
  background: #edf3f4;
}

button {
  font: inherit;
}

.app-shell {
  width: 100%;
  min-height: 100svh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: clamp(0px, 2.8vw, 24px);
  background:
    radial-gradient(circle at 50% 0%, rgba(199, 224, 230, 0.72), transparent 46%),
    #edf3f4;
}

.phone-screen {
  position: relative;
  width: min(100vw, 375px);
  min-height: 812px;
  overflow: hidden;
  background: linear-gradient(180deg, #c7e0e6 0%, #dcebee 58%, #ecf2f3 100%);
  box-shadow: 0 24px 70px rgba(45, 45, 58, 0.18);
}

.status-bar {
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 27px 0 44px;
  color: #000000;
}

.status-bar-time {
  font-size: 17px;
  font-weight: 700;
  line-height: 22px;
}

.status-bar-levels {
  width: 80px;
  height: 13px;
  object-fit: contain;
}

.top-navigation {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.icon-button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.icon-button img {
  width: 24px;
  height: 24px;
}

.screen-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 0 16px 48px;
}

.intro-header {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: 4px;
  padding-top: 6px;
  text-align: center;
}

.eyebrow {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #b6d2d9;
  color: #2d2d3a;
  font-size: 16px;
  line-height: 24px;
}

.intro-header h1 {
  margin: 0;
  color: #2d2d3a;
  font-size: 28px;
  font-weight: 700;
  line-height: 36px;
  letter-spacing: 0;
}

.intro-header p {
  margin: 0;
  color: #595969;
  font-size: 16px;
  line-height: 24px;
}

.thin-divider {
  width: 100%;
  height: 0;
}

.globe-composition {
  position: relative;
  width: 100%;
  margin-top: -2px;
}

.globe-window {
  position: relative;
  width: 343px;
  height: 192px;
  overflow: visible;
}

.globe-stage {
  position: absolute;
  top: -8px;
  left: 50%;
  width: 343px;
  height: 327px;
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  cursor: grab;
  touch-action: none;
  user-select: none;
  translate: -50% 0;
}

.globe-stage:active {
  cursor: grabbing;
}

.globe-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.city-label {
  position: absolute;
  position-anchor: --cobe-vietnam;
  bottom: anchor(top);
  left: anchor(center);
  z-index: 2;
  padding: 3px 6px 2px;
  color: #ffffff;
  background: #490be8;
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  translate:
    calc(-50% + var(--label-offset-x, 0px))
    calc(-6px + var(--label-offset-y, 0px));
  opacity: var(--label-visible);
  filter: blur(calc((1 - var(--label-visible)) * 5px));
  scale: calc(0.74 + (var(--label-visible) * 0.26));
  transform-origin: 50% calc(100% + 6px);
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(8, 60, 255, 0.12);
  transition:
    opacity 360ms ease,
    filter 420ms ease,
    scale 520ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, filter, scale;
  border-radius: 4px;
}

.current-location-label {
  bottom: auto;
  top: anchor(center);
  left: anchor(left);
  translate: calc(-100% - 9px) -50%;
  color: #061214;
  background: #00f5fa;
  transform-origin: calc(100% + 9px) 50%;
  box-shadow:
    0 0 0 1px rgba(0, 245, 250, 0.6),
    0 8px 20px rgba(0, 245, 250, 0.24);
}

.current-location-pulse {
  position: absolute;
  position-anchor: --cobe-vietnam;
  left: anchor(center);
  top: anchor(center);
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  translate: -50% -50%;
  z-index: 1;
  opacity: var(--label-visible);
  pointer-events: none;
}

.current-location-pulse-ring {
  position: absolute;
  inset: 0;
  border: 1px solid #00f5fa;
  border-radius: 50%;
  opacity: 0;
  box-shadow:
    0 0 0 4px rgba(0, 245, 250, 0.08),
    0 0 18px rgba(0, 245, 250, 0.32);
  animation: current-location-pulse 2s ease-out infinite;
}

.current-location-pulse-ring:nth-child(2) {
  animation-delay: 0.5s;
}

.current-location-pulse-dot {
  width: 8px;
  height: 8px;
  z-index: 1;
  border-radius: 50%;
  background: #00f5fa;
  box-shadow:
    0 0 0 3px rgba(199, 224, 230, 0.82),
    0 0 0 5px rgba(0, 245, 250, 0.34),
    0 0 18px rgba(0, 245, 250, 0.45);
}

@keyframes current-location-pulse {
  0% {
    opacity: 0.75;
    transform: scale(0.35);
  }

  100% {
    opacity: 0;
    transform: scale(1.55);
  }
}

.card,
.list-card {
  width: 100%;
  border-radius: 16px;
  background: #ffffff;
}

.destination-card {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: -60px;
  padding: 16px;
}

.card-heading {
  color: #2d2d3a;
  font-size: 18px;
  line-height: 24px;
}

.search-field {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 999px;
  background: #e2ecee;
  color: #595969;
  font-size: 16px;
  line-height: 24px;
}

.search-field img {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
}

.popular-label {
  color: #595969;
  font-size: 12px;
  line-height: 16px;
}

.destination-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.destination-option {
  position: relative;
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 4px;
  color: #595969;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

.flag-frame {
  position: relative;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid #c7e0e6;
  border-radius: 50%;
  background: #ffffff;
}

.flag-image,
.css-flag {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  overflow: hidden;
}

.flag-japan {
  position: relative;
  background: #ffffff;
}

.flag-japan::after {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: #e3163c;
}

.suggested-badge {
  position: absolute;
  top: -8px;
  left: -1px;
  padding: 0 4px;
  border-radius: 4px;
  background: #da004b;
  color: #ffffff;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}

.banner-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
}

.banner-card h2,
.banner-card p {
  margin: 0;
}

.banner-card h2 {
  color: #2d2d3a;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}

.banner-card p {
  color: #595969;
  font-size: 14px;
  line-height: 20px;
}

.primary-button {
  min-height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: #2d2d3a;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.content-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  margin: 0;
  color: #2d2d3a;
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
}

.list-card {
  overflow: hidden;
  padding: 0 16px;
}

.info-row {
  min-height: 64px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #c7e0e6;
}

.info-row:last-child {
  border-bottom: 0;
}

.info-row-icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
}

.info-row h3,
.info-row p {
  margin: 0;
}

.info-row h3 {
  color: #2d2d3a;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}

.info-row p {
  color: #595969;
  font-size: 14px;
  line-height: 20px;
}

.faq-card {
  padding: 0 16px;
}

.faq-row {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border: 0;
  border-bottom: 1px solid #c7e0e6;
  background: transparent;
  color: #2d2d3a;
  font-size: 16px;
  line-height: 24px;
  text-align: left;
}

.faq-row:last-child {
  border-bottom: 0;
}

.faq-row img {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.home-indicator {
  position: absolute;
  left: 50%;
  bottom: 8px;
  width: 139px;
  height: 5px;
  border-radius: 100px;
  background: #2d2d3a;
  translate: -50% 0;
}

@media (max-width: 374px) {
  .phone-screen {
    width: 100vw;
  }

  .screen-content {
    padding-right: 10px;
    padding-left: 10px;
  }

  .globe-window {
    width: calc(100vw - 20px);
  }

  .destination-row {
    gap: 8px;
  }

  .destination-option {
    font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .city-label {
    filter: none;
    scale: 1;
    transition-duration: 0.01ms;
  }

  .current-location-pulse-ring {
    animation: none;
    opacity: 0.7;
    transform: scale(0.92);
  }

  .current-location-pulse-ring:nth-child(2) {
    opacity: 0.25;
    transform: scale(1.28);
  }
}
```

- [ ] **Step 2: Run the build**

Run:

```bash
npm run build
```

Expected: `tsc --noEmit` succeeds and Vite completes the production build.

- [ ] **Step 3: Commit the visual styling**

Run:

```bash
git add src/styles.css
git commit -m "feat: style vas bill mobile prototype"
```

Expected: commit succeeds and includes only `src/styles.css`.

---

### Task 4: Browser Verification and Polish

**Files:**
- Modify: `src/App.tsx` only for TypeScript or visual defects found during verification
- Modify: `src/styles.css` only for visual defects found during verification

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL, commonly `http://localhost:5173/`.

- [ ] **Step 2: Inspect the prototype at mobile size**

Open the Vite URL in a browser at `375x812`.

Expected:

```text
The mobile screen fills the viewport width.
The status bar, navigation, eSIM pill, title, subtitle, globe, destination card, banner, benefits, FAQs, and home indicator are visible in the Figma order.
The globe is nonblank and partially sits behind the destination card.
Dragging the globe rotates it.
Text does not overlap incoherently.
```

- [ ] **Step 3: Inspect the prototype at desktop size**

Use a desktop viewport such as `1280x900`.

Expected:

```text
The 375px mobile screen is centered in the page.
The globe remains nonblank and centered in its slot.
The destination flags, benefit rows, FAQ rows, and home indicator remain inside the phone frame.
```

- [ ] **Step 4: Run the final build**

Run:

```bash
npm run build
```

Expected: `tsc --noEmit` succeeds and Vite completes the production build.

- [ ] **Step 5: Commit verification polish**

Run this only when Step 2 or Step 3 required code or CSS changes:

```bash
git add src/App.tsx src/styles.css
git commit -m "fix: polish vas bill prototype verification"
```

Expected: commit succeeds and includes only verification-driven app or CSS changes.
