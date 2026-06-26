import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type MouseEvent,
  type PointerEvent,
} from "react";
import createGlobe, { type Arc, type Marker } from "cobe";
import arrowLeftIcon from "./assets/figma/arrow-left.svg";
import chevronRightIcon from "./assets/figma/chevron-right.svg";
import flagAustralia from "./assets/figma/flag-australia.svg";
import flagHongKong from "./assets/figma/flag-hong-kong.svg";
import flagTaiwan from "./assets/figma/flag-taiwan.svg";
import helpIcon from "./assets/figma/help.svg";
import iconClock from "./assets/figma/icon-clock.svg";
import iconElectricity from "./assets/figma/icon-electricity.svg";
import iconFavorite from "./assets/figma/icon-favorite.svg";
import iconGlobe from "./assets/figma/icon-globe.svg";
import iconInstant from "./assets/figma/icon-instant.svg";
import searchIcon from "./assets/figma/search.svg";
import statusIcon from "./assets/figma/status.svg";

type City = Marker & {
  id: string;
  label: string;
  labelOffset?: [number, number];
};

const CONNECTOR_COLOR = [0, 245 / 255, 250 / 255] satisfies [number, number, number];
const MAX_VISIBLE_DESTINATIONS = 4;
const MOBILE_VISIBLE_DESTINATIONS = 4;
const MOBILE_VISIBLE_DESTINATIONS_WIDTH = 520;
const ACTIVE_SWITCH_MARGIN = 0.015;
const ARC_DRAW_DURATION_MS = 800;
const ARC_MIN_PROGRESS = 0.025;
const STANDALONE_GLOBE_SIZE = 520;
const GLOBE_EXPORT_SIZE = STANDALONE_GLOBE_SIZE * 2;

const CURRENT_LOCATION: City = {
  id: "vietnam",
  label: "Vietnam",
  location: [16.0544, 108.2022],
  size: 0.07,
};

const DESTINATION_MARKERS: City[] = [
  { id: "japan", label: "Japan", location: [35.6762, 139.6503], size: 0.04, labelOffset: [22, -28] },
  { id: "taiwan", label: "Taiwan", location: [25.033, 121.5654], size: 0.04, labelOffset: [-22, 5] },
  {
    id: "australia",
    label: "Australia",
    location: [-25.2744, 133.7751],
    size: 0.04,
    labelOffset: [18, 8],
  },
  {
    id: "hong-kong",
    label: "HongKong",
    location: [22.3193, 114.1694],
    size: 0.04,
    labelOffset: [-4, -44],
  },
];

const INITIAL_ROTATION = {
  phi: 2.824,
  theta: 0.28,
};

type Rotation = typeof INITIAL_ROTATION;
type Location = [number, number];
type SpherePoint = [number, number, number];

type DestinationCandidate = {
  marker: City;
  score: number;
};

type ArcAnimationState = {
  destinationId: string | null;
  startedAt: number;
};

type DestinationSelection = {
  activeDestination: City | null;
  activeDestinationId: string | null;
  visibleDestinationIds: string[];
};

type AppRoute = "portal" | "globe" | "prototype";

function toSpherePoint([latitude, longitude]: Location): SpherePoint {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180 - Math.PI;
  const cosLat = Math.cos(lat);

  return [
    -cosLat * Math.cos(lon),
    Math.sin(lat),
    cosLat * Math.sin(lon),
  ] satisfies [number, number, number];
}

function normalizeSpherePoint([x, y, z]: SpherePoint): SpherePoint {
  const length = Math.hypot(x, y, z);

  if (length === 0) {
    return [0, 1, 0];
  }

  return [x / length, y / length, z / length];
}

function toLocation([x, y, z]: SpherePoint): Location {
  const latitude = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
  const longitude = (Math.atan2(z, -x) + Math.PI) * 180 / Math.PI;

  return [latitude, longitude > 180 ? longitude - 360 : longitude];
}

function interpolateSpherePoint(from: SpherePoint, to: SpherePoint, progress: number): SpherePoint {
  const dot = Math.max(-1, Math.min(1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  if (sinOmega < 0.0001) {
    return normalizeSpherePoint([
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
      from[2] + (to[2] - from[2]) * progress,
    ]);
  }

  const fromScale = Math.sin((1 - progress) * omega) / sinOmega;
  const toScale = Math.sin(progress * omega) / sinOmega;

  return [
    from[0] * fromScale + to[0] * toScale,
    from[1] * fromScale + to[1] * toScale,
    from[2] * fromScale + to[2] * toScale,
  ];
}

function interpolateLocation(from: Location, to: Location, progress: number): Location {
  return toLocation(
    interpolateSpherePoint(
      toSpherePoint(from),
      toSpherePoint(to),
      Math.max(ARC_MIN_PROGRESS, Math.min(1, progress)),
    ),
  );
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function getArcDrawProgress(now: number, animation: ArcAnimationState, reduceMotion: boolean) {
  if (reduceMotion || !animation.destinationId) {
    return 1;
  }

  const elapsed = Math.max(0, now - animation.startedAt);
  const linearProgress = Math.min(1, elapsed / ARC_DRAW_DURATION_MS);

  return Math.max(ARC_MIN_PROGRESS, easeOutCubic(linearProgress));
}

function projectLocation(location: Location, { phi, theta }: Rotation) {
  const [x, y, z] = toSpherePoint(location);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const projectedX = cosPhi * x + sinPhi * z;
  const projectedY = sinPhi * sinTheta * x + cosTheta * y - cosPhi * sinTheta * z;
  const depth = -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z;

  return {
    depth,
    score: projectedX * projectedX + projectedY * projectedY,
  };
}

function getDestinationSelection(
  rotation: Rotation,
  previousActiveDestinationId?: string | null,
  visibleLimit = getVisibleDestinationLimit(),
): DestinationSelection {
  const candidates = DESTINATION_MARKERS
    .map((marker): DestinationCandidate | null => {
      const projection = projectLocation(marker.location, rotation);

      if (projection.depth < 0) {
        return null;
      }

      return {
        marker,
        score: projection.score,
      };
    })
    .filter((candidate): candidate is DestinationCandidate => Boolean(candidate))
    .sort((a, b) => a.score - b.score);

  const visibleCandidates = candidates.slice(0, visibleLimit);
  let activeCandidate = visibleCandidates[0] ?? null;

  if (previousActiveDestinationId && activeCandidate?.marker.id !== previousActiveDestinationId) {
    const previousCandidate = visibleCandidates.find(
      (candidate) => candidate.marker.id === previousActiveDestinationId,
    );

    if (
      previousCandidate &&
      activeCandidate &&
      previousCandidate.score <= activeCandidate.score + ACTIVE_SWITCH_MARGIN
    ) {
      activeCandidate = previousCandidate;
    }
  }

  return {
    activeDestination: activeCandidate?.marker ?? null,
    activeDestinationId: activeCandidate?.marker.id ?? null,
    visibleDestinationIds: visibleCandidates.map((candidate) => candidate.marker.id),
  };
}

function getVisibleDestinationLimit() {
  if (typeof window === "undefined") {
    return MAX_VISIBLE_DESTINATIONS;
  }

  return window.innerWidth <= MOBILE_VISIBLE_DESTINATIONS_WIDTH
    ? MOBILE_VISIBLE_DESTINATIONS
    : MAX_VISIBLE_DESTINATIONS;
}

function getActiveArc(destination: City | null, progress = 1): Arc[] {
  if (!destination) {
    return [];
  }

  return [
    {
      id: `vietnam-to-${destination.id}`,
      from: CURRENT_LOCATION.location,
      to: progress >= 1
        ? destination.location
        : interpolateLocation(CURRENT_LOCATION.location, destination.location, progress),
    },
  ];
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64Data] = dataUrl.split(",");
  const mimeType = metadata.match(/^data:(.*);base64$/)?.[1] ?? "image/png";
  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function createGlobePngUrl(canvas: HTMLCanvasElement) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = GLOBE_EXPORT_SIZE;
  exportCanvas.height = GLOBE_EXPORT_SIZE;

  const context = exportCanvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare the PNG export.");
  }

  context.clearRect(0, 0, GLOBE_EXPORT_SIZE, GLOBE_EXPORT_SIZE);
  context.drawImage(canvas, 0, 0, GLOBE_EXPORT_SIZE, GLOBE_EXPORT_SIZE);

  const blob = dataUrlToBlob(exportCanvas.toDataURL("image/png"));

  return URL.createObjectURL(blob);
}

function areSameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function getGlobeDestinationMarkers(visibleDestinationIds: string[]) {
  const visibleIds = new Set(visibleDestinationIds);

  return DESTINATION_MARKERS.map((marker) => {
    if (visibleIds.has(marker.id)) {
      return marker;
    }

    return {
      ...marker,
      size: 0.001,
    };
  });
}

type LabelStyle = CSSProperties & {
  positionAnchor: string;
  "--label-visible": string;
  "--label-offset-x": string;
  "--label-offset-y": string;
};

function getLabelStyle(city: City, selected = true): LabelStyle {
  const [offsetX = 0, offsetY = 0] = city.labelOffset ?? [];

  return {
    positionAnchor: `--cobe-${city.id}`,
    "--label-visible": selected ? `var(--cobe-visible-${city.id}, 0)` : "0",
    "--label-offset-x": `${offsetX}px`,
    "--label-offset-y": `${offsetY}px`,
  };
}

const currentLocationStyle = getLabelStyle(CURRENT_LOCATION);
const INITIAL_DESTINATION_SELECTION = getDestinationSelection(INITIAL_ROTATION);

type DestinationOption = {
  id: string;
  label: string;
  highlighted?: boolean;
  flagImage?: string;
  flagClassName?: string;
};

type SearchDestination = {
  id: string;
  label: string;
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
  { id: "australia", label: "Australia", highlighted: true, flagImage: flagAustralia },
  { id: "taiwan", label: "Taiwan", flagImage: flagTaiwan },
  { id: "hong-kong", label: "HongKong", flagImage: flagHongKong },
  { id: "japan", label: "Japan", flagClassName: "flag-japan" },
];

const SEARCH_DESTINATIONS: SearchDestination[] = [
  { id: "algeria", label: "Algeria", flagClassName: "flag-algeria" },
  { id: "andorra", label: "Andorra", flagClassName: "flag-andorra" },
  { id: "angola", label: "Angola", flagClassName: "flag-angola" },
  { id: "argentina", label: "Argentina", flagClassName: "flag-argentina" },
  { id: "armenia", label: "Armenia", flagClassName: "flag-armenia" },
  { id: "australia", label: "Australia", flagImage: flagAustralia },
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

const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
] as const;

function getRouteFromPathname(pathname: string): AppRoute {
  const normalizedPathname = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

  if (normalizedPathname === "/globe") {
    return "globe";
  }

  if (normalizedPathname === "/prototype") {
    return "prototype";
  }

  return "portal";
}

function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === "undefined") {
      return "portal";
    }

    return getRouteFromPathname(window.location.pathname);
  });

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRouteFromPathname(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();

    if (window.location.pathname !== href) {
      window.history.pushState(null, "", href);
    }

    setRoute(getRouteFromPathname(href));
    window.scrollTo({ left: 0, top: 0 });
  };

  return { route, navigate };
}

function CobeGlobe({
  className,
  ariaLabel = "Draggable COBE globe",
  showMarkers = true,
  renderPixelRatio,
  preserveDrawingBuffer = false,
  exportCanvasRef,
}: {
  className?: string;
  ariaLabel?: string;
  showMarkers?: boolean;
  renderPixelRatio?: number;
  preserveDrawingBuffer?: boolean;
  exportCanvasRef?: MutableRefObject<HTMLCanvasElement | null>;
}) {
  const [visibleDestinationIds, setVisibleDestinationIds] = useState(
    INITIAL_DESTINATION_SELECTION.visibleDestinationIds,
  );
  const [activeDestinationId, setActiveDestinationId] = useState(
    INITIAL_DESTINATION_SELECTION.activeDestinationId,
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>();
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const sizeRef = useRef({ width: 900, height: 900 });
  const rotationRef = useRef(INITIAL_ROTATION);
  const showMarkersRef = useRef(showMarkers);
  const visibleDestinationIdsRef = useRef(INITIAL_DESTINATION_SELECTION.visibleDestinationIds);
  const activeDestinationIdRef = useRef(INITIAL_DESTINATION_SELECTION.activeDestinationId);
  const arcAnimationRef = useRef<ArcAnimationState>({
    destinationId: INITIAL_DESTINATION_SELECTION.activeDestinationId,
    startedAt: 0,
  });
  const reduceMotionRef = useRef(false);
  const dragRef = useRef({
    active: false,
    pointerId: 0,
    x: 0,
    y: 0,
    phi: INITIAL_ROTATION.phi,
    theta: INITIAL_ROTATION.theta,
  });

  useEffect(() => {
    showMarkersRef.current = showMarkers;
  }, [showMarkers]);

  useEffect(() => {
    if (!exportCanvasRef) {
      return;
    }

    exportCanvasRef.current = canvasRef.current;

    return () => {
      exportCanvasRef.current = null;
    };
  }, [exportCanvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const updateSize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = renderPixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);

      sizeRef.current = {
        width: Math.max(320, Math.floor(bounds.width * pixelRatio)),
        height: Math.max(320, Math.floor(bounds.height * pixelRatio)),
      };
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(canvas);

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotionPreference = () => {
      reduceMotionRef.current = reducedMotionQuery.matches;

      if (!reducedMotionQuery.matches) {
        arcAnimationRef.current = {
          destinationId: activeDestinationIdRef.current,
          startedAt: performance.now(),
        };
      }
    };

    updateReducedMotionPreference();

    reducedMotionQuery.addEventListener("change", updateReducedMotionPreference);

    const startedAt = performance.now();
    arcAnimationRef.current = {
      destinationId: INITIAL_DESTINATION_SELECTION.activeDestinationId,
      startedAt,
    };

    globeRef.current = createGlobe(canvas, {
      devicePixelRatio: 1,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      phi: rotationRef.current.phi,
      theta: rotationRef.current.theta,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      mapBaseBrightness: 0,
      baseColor: [1, 1, 1],
      markerColor: CONNECTOR_COLOR,
      glowColor: [1, 1, 1],
      markers: showMarkersRef.current
        ? [
          CURRENT_LOCATION,
          ...getGlobeDestinationMarkers(INITIAL_DESTINATION_SELECTION.visibleDestinationIds),
        ]
        : [],
      arcs: showMarkersRef.current
        ? getActiveArc(
          INITIAL_DESTINATION_SELECTION.activeDestination,
          getArcDrawProgress(startedAt, arcAnimationRef.current, reduceMotionRef.current),
        )
        : [],
      arcColor: CONNECTOR_COLOR,
      arcWidth: 0.4,
      arcHeight: 0.25,
      markerElevation: 0,
      scale: 1,
      offset: [0, 0],
      ...(preserveDrawingBuffer
        ? { context: { alpha: true, preserveDrawingBuffer: true } }
        : {}),
    });

    const render = () => {
      const now = performance.now();
      const selection = getDestinationSelection(
        rotationRef.current,
        activeDestinationIdRef.current,
      );

      if (!areSameIds(selection.visibleDestinationIds, visibleDestinationIdsRef.current)) {
        visibleDestinationIdsRef.current = selection.visibleDestinationIds;
        setVisibleDestinationIds(selection.visibleDestinationIds);
      }

      if (selection.activeDestinationId !== activeDestinationIdRef.current) {
        activeDestinationIdRef.current = selection.activeDestinationId;
        arcAnimationRef.current = {
          destinationId: selection.activeDestinationId,
          startedAt: now,
        };
        setActiveDestinationId(selection.activeDestinationId);
      }

      globeRef.current?.update({
        width: sizeRef.current.width,
        height: sizeRef.current.height,
        phi: rotationRef.current.phi,
        theta: rotationRef.current.theta,
        markers: showMarkersRef.current
          ? [CURRENT_LOCATION, ...getGlobeDestinationMarkers(selection.visibleDestinationIds)]
          : [],
        arcs: showMarkersRef.current
          ? getActiveArc(
            selection.activeDestination,
            getArcDrawProgress(now, arcAnimationRef.current, reduceMotionRef.current),
          )
          : [],
      });

      frameRef.current = window.requestAnimationFrame(render);
    };

    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }

      reducedMotionQuery.removeEventListener("change", updateReducedMotionPreference);
      resizeObserver.disconnect();
      globeRef.current?.destroy();
      globeRef.current = null;
    };
  }, [preserveDrawingBuffer, renderPixelRatio]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      phi: rotationRef.current.phi,
      theta: rotationRef.current.theta,
    };

    stageRef.current?.setPointerCapture(event.pointerId);
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextTheta = dragState.theta + (event.clientY - dragState.y) / 360;

    rotationRef.current = {
      phi: dragState.phi + (event.clientX - dragState.x) / 220,
      theta: Math.max(-0.7, Math.min(0.7, nextTheta)),
    };
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === event.pointerId) {
      dragRef.current.active = false;
    }

    if (stageRef.current?.hasPointerCapture(event.pointerId)) {
      stageRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const visibleDestinationIdSet = new Set(visibleDestinationIds);

  return (
    <div
      ref={stageRef}
      className={className ? `globe-stage ${className}` : "globe-stage"}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <canvas ref={canvasRef} className="globe-canvas" aria-label={ariaLabel} />

      {showMarkers ? (
        <>
          <span className="current-location-pulse" style={currentLocationStyle} aria-hidden="true">
            <span className="current-location-pulse-ring" />
            <span className="current-location-pulse-ring" />
            <span className="current-location-pulse-dot" />
          </span>
          <span className="city-label current-location-label" style={currentLocationStyle}>
            {CURRENT_LOCATION.label}
          </span>

          {DESTINATION_MARKERS.map((city) => (
            <span
              key={city.id}
              className="city-label"
              data-active={city.id === activeDestinationId ? "true" : undefined}
              style={getLabelStyle(city, visibleDestinationIdSet.has(city.id))}
            >
              {city.label}
            </span>
          ))}
        </>
      ) : null}
    </div>
  );
}

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

function DestinationChip({ option }: { option: DestinationOption }) {
  return (
    <button className="destination-chip" type="button">
      <span className="flag-frame">
        {option.flagImage ? (
          <img className="flag-image" src={option.flagImage} alt="" />
        ) : (
          <span className={`css-flag ${option.flagClassName ?? ""}`} aria-hidden="true" />
        )}
      </span>
      <span>{option.label}</span>
      {option.highlighted ? <span className="destination-highlight" aria-hidden="true" /> : null}
    </button>
  );
}

function DestinationSearchResults() {
  return (
    <section className="destination-results" aria-labelledby="destination-results-heading">
      <h2 id="destination-results-heading">All destinations</h2>
      <div className="destination-list">
        {SEARCH_DESTINATIONS.map((destination) => (
          <button className="destination-list-row" key={destination.id} type="button">
            <span className="flag-frame">
              {destination.flagImage ? (
                <img className="flag-image" src={destination.flagImage} alt="" />
              ) : (
                <span className={`css-flag ${destination.flagClassName ?? ""}`} aria-hidden="true" />
              )}
            </span>
            <span>{destination.label}</span>
            <img className="destination-list-chevron" src={chevronRightIcon} alt="" />
          </button>
        ))}
      </div>
    </section>
  );
}

function DestinationCard({
  isSearchOpen,
  onOpenSearch,
  onCloseSearch,
}: {
  isSearchOpen: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
}) {
  return (
    <section
      className={`card destination-card${isSearchOpen ? " is-search-card" : ""}`}
      aria-labelledby="destination-heading"
    >
      <div className="destination-card-main">
        <div className="card-heading" id="destination-heading">Where?</div>
        <div className="search-row">
          <button
            className={`search-field${isSearchOpen ? " is-focused" : ""}`}
            type="button"
            aria-label="Search your destination"
            onClick={onOpenSearch}
          >
            <img src={searchIcon} alt="" />
            <span className="search-input-copy">
              {isSearchOpen ? <span className="search-cursor" aria-hidden="true" /> : null}
              <span>Search your destination</span>
            </span>
          </button>
          {isSearchOpen ? (
            <button className="search-cancel" type="button" onClick={onCloseSearch}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className="destination-row">
        {DESTINATION_OPTIONS.map((option) => (
          <DestinationChip key={option.id} option={option} />
        ))}
      </div>
      {isSearchOpen ? <DestinationSearchResults /> : null}
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

function VisualKeyboard() {
  return (
    <div className="visual-keyboard" aria-hidden="true">
      <div className="keyboard-letter-rows">
        <div className="keyboard-row keyboard-row-top">
          {KEYBOARD_ROWS[0].map((key) => (
            <span className="keyboard-key" key={key}>{key}</span>
          ))}
        </div>
        <div className="keyboard-row keyboard-row-middle">
          {KEYBOARD_ROWS[1].map((key) => (
            <span className="keyboard-key" key={key}>{key}</span>
          ))}
        </div>
        <div className="keyboard-row keyboard-row-bottom">
          <span className="keyboard-key keyboard-action-key keyboard-key-shift">
            <span className="keyboard-shift-icon" />
          </span>
          <span className="keyboard-bottom-letters">
            {KEYBOARD_ROWS[2].map((key) => (
              <span className="keyboard-key" key={key}>{key}</span>
            ))}
          </span>
          <span className="keyboard-key keyboard-action-key keyboard-key-delete">
            <span className="keyboard-delete-icon" />
          </span>
        </div>
      </div>

      <div className="keyboard-command-row">
        <span className="keyboard-key keyboard-command-key">123</span>
        <span className="keyboard-key keyboard-space-key">space</span>
        <span className="keyboard-key keyboard-command-key">return</span>
      </div>

      <div className="keyboard-utility-row">
        <span className="keyboard-emoji-key" />
        <span className="keyboard-dictation-key" />
      </div>
      <div className="keyboard-home-indicator" />
    </div>
  );
}

function PortalPage({
  onNavigate,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <main className="portal-shell" aria-labelledby="portal-heading">
      <section className="portal-panel">
        <div>
          <h1 id="portal-heading">COBE Globe</h1>
        </div>

        <div className="portal-link-grid" aria-label="Pages">
          <a className="portal-link-card" href="/globe" onClick={(event) => onNavigate(event, "/globe")}>
            <span className="portal-link-title">Globe only</span>
            <span className="portal-link-copy">Standalone interactive globe</span>
          </a>
          <a
            className="portal-link-card"
            href="/prototype"
            onClick={(event) => onNavigate(event, "/prototype")}
          >
            <span className="portal-link-title">Prototype</span>
            <span className="portal-link-copy">Mobile eSIM travel screen</span>
          </a>
        </div>
      </section>
    </main>
  );
}

function GlobeOnlyPage() {
  const [hideMarkers, setHideMarkers] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const standaloneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (exportUrlRef.current) {
        URL.revokeObjectURL(exportUrlRef.current);
      }
    };
  }, []);

  const prepareGlobeDownload = (link: HTMLAnchorElement) => {
    const canvas = standaloneCanvasRef.current;

    if (!canvas) {
      return false;
    }

    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
    }

    const url = createGlobePngUrl(canvas);
    exportUrlRef.current = url;
    link.href = url;

    return true;
  };

  const exportStandaloneGlobe = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isExporting || !prepareGlobeDownload(event.currentTarget)) {
      event.preventDefault();
      return;
    }

    setIsExporting(true);
    window.setTimeout(() => setIsExporting(false), 150);
  };

  return (
    <main className="standalone-globe-page" aria-label="Globe only">
      <div className="standalone-globe-frame">
        <CobeGlobe
          className="standalone-globe-stage"
          ariaLabel="Draggable standalone COBE globe"
          showMarkers={!hideMarkers}
          renderPixelRatio={2}
          preserveDrawingBuffer
          exportCanvasRef={standaloneCanvasRef}
        />
      </div>
      <div className="standalone-globe-controls" aria-label="Globe export controls">
        <label className="standalone-marker-toggle">
          <input
            type="checkbox"
            checked={hideMarkers}
            onChange={(event) => setHideMarkers(event.currentTarget.checked)}
          />
          <span>Hide markers and lines</span>
        </label>
        <a
          className="standalone-export-button"
          href="#"
          download={`cobe-globe-${GLOBE_EXPORT_SIZE}.png`}
          onPointerDown={(event) => {
            if (!isExporting) {
              prepareGlobeDownload(event.currentTarget);
            }
          }}
          onFocus={(event) => {
            if (!isExporting) {
              prepareGlobeDownload(event.currentTarget);
            }
          }}
          onClick={exportStandaloneGlobe}
          aria-disabled={isExporting ? "true" : undefined}
        >
          {isExporting ? "Exporting..." : "Export PNG"}
        </a>
      </div>
    </main>
  );
}

function PrototypePage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <main className="app-shell">
      <section
        className={`phone-screen${isSearchOpen ? " is-search-open" : ""}`}
        aria-label="eSIM travel intro prototype"
      >
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
            <div className="destination-card-stack">
              <DestinationCard
                isSearchOpen={isSearchOpen}
                onOpenSearch={() => setIsSearchOpen(true)}
                onCloseSearch={() => setIsSearchOpen(false)}
              />
              <BannerCard />
            </div>
          </div>

          <BenefitsCard />
          <FaqCard />
        </div>

        <VisualKeyboard />
        <div className="home-indicator" aria-hidden="true" />
      </section>
    </main>
  );
}

export default function App() {
  const { route, navigate } = useAppRoute();

  if (route === "globe") {
    return <GlobeOnlyPage />;
  }

  if (route === "prototype") {
    return <PrototypePage />;
  }

  return <PortalPage onNavigate={navigate} />;
}
