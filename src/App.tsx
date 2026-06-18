import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import createGlobe, { type Arc, type Marker } from "cobe";

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

function CobeGlobe() {
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
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const updateSize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

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
      markers: [
        CURRENT_LOCATION,
        ...getGlobeDestinationMarkers(INITIAL_DESTINATION_SELECTION.visibleDestinationIds),
      ],
      arcs: getActiveArc(
        INITIAL_DESTINATION_SELECTION.activeDestination,
        getArcDrawProgress(startedAt, arcAnimationRef.current, reduceMotionRef.current),
      ),
      arcColor: CONNECTOR_COLOR,
      arcWidth: 0.4,
      arcHeight: 0.25,
      markerElevation: 0,
      scale: 1,
      offset: [0, 0],
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
        markers: [CURRENT_LOCATION, ...getGlobeDestinationMarkers(selection.visibleDestinationIds)],
        arcs: getActiveArc(
          selection.activeDestination,
          getArcDrawProgress(now, arcAnimationRef.current, reduceMotionRef.current),
        ),
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
  }, []);

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
      className="globe-stage"
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <canvas ref={canvasRef} className="globe-canvas" aria-label="Draggable COBE globe" />

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
    </div>
  );
}

export default function App() {
  return (
    <main className="app-shell">
      <CobeGlobe />
    </main>
  );
}
