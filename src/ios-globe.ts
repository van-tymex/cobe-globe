import createGlobe, { type Arc, type Marker } from "cobe";
import "./ios-globe.css";

type City = Marker & {
  id: string;
  label: string;
  labelOffset?: [number, number];
};

type Location = [number, number];
type Rotation = {
  phi: number;
  theta: number;
};

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

declare global {
  interface Window {
    focusDestination?: (destinationId: string) => void;
    webkit?: {
      messageHandlers?: {
        globeEvents?: {
          postMessage: (message: unknown) => void;
        };
      };
    };
  }
}

const CONNECTOR_COLOR = [0, 245 / 255, 250 / 255] satisfies [number, number, number];
const MAX_VISIBLE_DESTINATIONS = 4;
const ACTIVE_SWITCH_MARGIN = 0.015;
const ARC_DRAW_DURATION_MS = 800;
const ARC_MIN_PROGRESS = 0.025;
const ROTATION_ANIMATION_DURATION_MS = 520;

const INITIAL_ROTATION: Rotation = {
  phi: 2.824,
  theta: 0.28,
};

const CURRENT_LOCATION: City = {
  id: "vietnam",
  label: "Vietnam",
  location: [16.0544, 108.2022],
  size: 0.07,
};

const DESTINATION_MARKERS: City[] = [
  { id: "japan", label: "Japan", location: [35.6762, 139.6503], size: 0.04, labelOffset: [22, -28] },
  { id: "taiwan", label: "Taiwan", location: [25.033, 121.5654], size: 0.04, labelOffset: [-22, 5] },
  { id: "australia", label: "Australia", location: [-25.2744, 133.7751], size: 0.04, labelOffset: [18, 8] },
  { id: "hong-kong", label: "HongKong", location: [22.3193, 114.1694], size: 0.04, labelOffset: [-4, -44] },
];

const canvasElement = document.querySelector<HTMLCanvasElement>("#globe-canvas");
const stageElement = document.querySelector<HTMLDivElement>("#globe-stage");
const labels = new Map(
  Array.from(document.querySelectorAll<HTMLElement>("[data-city-label]"))
    .map((label) => [label.dataset.cityLabel ?? "", label]),
);

if (!canvasElement || !stageElement) {
  throw new Error("Missing iOS globe DOM elements.");
}

const canvas = canvasElement;
const stage = stageElement;

function toSpherePoint([latitude, longitude]: Location): SpherePoint {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180 - Math.PI;
  const cosLat = Math.cos(lat);

  return [
    -cosLat * Math.cos(lon),
    Math.sin(lat),
    cosLat * Math.sin(lon),
  ];
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

function shortestAngleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
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

function getRotationForLocation(location: Location): Rotation {
  const [x, y, z] = toSpherePoint(location);

  return {
    phi: Math.atan2(-x, z),
    theta: Math.max(-0.58, Math.min(0.58, -Math.asin(Math.max(-1, Math.min(1, y))) * 0.55)),
  };
}

function getDestinationSelection(
  rotation: Rotation,
  previousActiveDestinationId?: string | null,
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

  const visibleCandidates = candidates.slice(0, MAX_VISIBLE_DESTINATIONS);
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

function getArcDrawProgress(now: number, animation: ArcAnimationState, reduceMotion: boolean) {
  if (reduceMotion || !animation.destinationId) {
    return 1;
  }

  const elapsed = Math.max(0, now - animation.startedAt);
  const linearProgress = Math.min(1, elapsed / ARC_DRAW_DURATION_MS);

  return Math.max(ARC_MIN_PROGRESS, easeOutCubic(linearProgress));
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

function updateCanvasSize() {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  return {
    width: Math.max(320, Math.floor(bounds.width * pixelRatio)),
    height: Math.max(320, Math.floor(bounds.height * pixelRatio)),
  };
}

function updateLabels(activeDestinationId: string | null, visibleDestinationIds: string[]) {
  const visibleIds = new Set(visibleDestinationIds);

  labels.forEach((label, id) => {
    const shouldShowLabel = id === "vietnam" || id === activeDestinationId;

    label.style.setProperty("--label-anchor", `--cobe-${id}`);
    label.style.setProperty("--label-visible", shouldShowLabel && (id === "vietnam" || visibleIds.has(id))
      ? `var(--cobe-visible-${id}, 0)`
      : "0");

    const city = id === "vietnam"
      ? CURRENT_LOCATION
      : DESTINATION_MARKERS.find((marker) => marker.id === id);
    const [offsetX = 0, offsetY = 0] = city?.labelOffset ?? [];

    label.style.setProperty("--label-offset-x", `${offsetX}px`);
    label.style.setProperty("--label-offset-y", `${offsetY}px`);
    label.dataset.active = id === activeDestinationId ? "true" : "false";
  });
}

function postActiveDestination(activeDestinationId: string | null) {
  if (!activeDestinationId) {
    return;
  }

  window.webkit?.messageHandlers?.globeEvents?.postMessage({
    event: "activeDestinationChanged",
    destinationId: activeDestinationId,
  });
}

let size = updateCanvasSize();
let rotation = { ...INITIAL_ROTATION };
let visibleDestinationIds = getDestinationSelection(INITIAL_ROTATION).visibleDestinationIds;
let activeDestinationId = getDestinationSelection(INITIAL_ROTATION).activeDestinationId;
let forcedDestinationId: string | null = activeDestinationId;
let rotationAnimation: {
  from: Rotation;
  to: Rotation;
  startedAt: number;
} | null = null;
let arcAnimation: ArcAnimationState = {
  destinationId: activeDestinationId,
  startedAt: performance.now(),
};
let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dragState = {
  active: false,
  pointerId: 0,
  x: 0,
  y: 0,
  phi: rotation.phi,
  theta: rotation.theta,
};

updateLabels(activeDestinationId, visibleDestinationIds);

const globe = createGlobe(canvas, {
  devicePixelRatio: 1,
  width: size.width,
  height: size.height,
  phi: rotation.phi,
  theta: rotation.theta,
  dark: 0,
  diffuse: 1.2,
  mapSamples: 16000,
  mapBrightness: 4.4,
  mapBaseBrightness: 0.08,
  baseColor: [0.78, 0.94, 0.96],
  markerColor: CONNECTOR_COLOR,
  glowColor: [0.72, 0.9, 0.95],
  markers: [CURRENT_LOCATION, ...getGlobeDestinationMarkers(visibleDestinationIds)],
  arcs: getActiveArc(
    DESTINATION_MARKERS.find((marker) => marker.id === activeDestinationId) ?? null,
    getArcDrawProgress(performance.now(), arcAnimation, reduceMotion),
  ),
  arcColor: CONNECTOR_COLOR,
  arcWidth: 0.4,
  arcHeight: 0.25,
  markerElevation: 0,
  scale: 1,
  offset: [0, 0],
});

const resizeObserver = new ResizeObserver(() => {
  size = updateCanvasSize();
});

resizeObserver.observe(canvas);

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
reducedMotionQuery.addEventListener("change", () => {
  reduceMotion = reducedMotionQuery.matches;
});

stage.addEventListener("pointerdown", (event) => {
  dragState.active = true;
  dragState.pointerId = event.pointerId;
  dragState.x = event.clientX;
  dragState.y = event.clientY;
  dragState.phi = rotation.phi;
  dragState.theta = rotation.theta;
  forcedDestinationId = null;
  rotationAnimation = null;
  stage.setPointerCapture(event.pointerId);
});

stage.addEventListener("pointermove", (event) => {
  if (!dragState.active || dragState.pointerId !== event.pointerId) {
    return;
  }

  const nextTheta = dragState.theta + (event.clientY - dragState.y) / 360;

  rotation = {
    phi: dragState.phi + (event.clientX - dragState.x) / 220,
    theta: Math.max(-0.7, Math.min(0.7, nextTheta)),
  };
});

function stopDrag(event: PointerEvent) {
  if (dragState.pointerId === event.pointerId) {
    dragState.active = false;
  }

  if (stage.hasPointerCapture(event.pointerId)) {
    stage.releasePointerCapture(event.pointerId);
  }
}

stage.addEventListener("pointerup", stopDrag);
stage.addEventListener("pointercancel", stopDrag);

window.focusDestination = (destinationId: string) => {
  const destination = DESTINATION_MARKERS.find((marker) => marker.id === destinationId);

  if (!destination) {
    return;
  }

  const targetRotation = getRotationForLocation(destination.location);

  forcedDestinationId = destination.id;
  activeDestinationId = destination.id;
  arcAnimation = {
    destinationId: destination.id,
    startedAt: performance.now(),
  };
  rotationAnimation = reduceMotion
    ? null
    : {
      from: { ...rotation },
      to: targetRotation,
      startedAt: performance.now(),
    };

  if (reduceMotion) {
    rotation = targetRotation;
  }

  postActiveDestination(activeDestinationId);
  updateLabels(activeDestinationId, visibleDestinationIds);
};

function render() {
  const now = performance.now();

  if (rotationAnimation) {
    const progress = Math.min(1, (now - rotationAnimation.startedAt) / ROTATION_ANIMATION_DURATION_MS);
    const eased = easeOutCubic(progress);

    rotation = {
      phi: rotationAnimation.from.phi + shortestAngleDelta(rotationAnimation.from.phi, rotationAnimation.to.phi) * eased,
      theta: rotationAnimation.from.theta + (rotationAnimation.to.theta - rotationAnimation.from.theta) * eased,
    };

    if (progress >= 1) {
      rotationAnimation = null;
    }
  }

  const selection = getDestinationSelection(rotation, forcedDestinationId ?? activeDestinationId);
  const nextActiveDestination = forcedDestinationId
    ? DESTINATION_MARKERS.find((marker) => marker.id === forcedDestinationId) ?? selection.activeDestination
    : selection.activeDestination;
  const nextActiveDestinationId = nextActiveDestination?.id ?? null;

  visibleDestinationIds = selection.visibleDestinationIds;

  if (nextActiveDestinationId !== activeDestinationId) {
    activeDestinationId = nextActiveDestinationId;
    arcAnimation = {
      destinationId: activeDestinationId,
      startedAt: now,
    };
    postActiveDestination(activeDestinationId);
  }

  updateLabels(activeDestinationId, visibleDestinationIds);

  globe.update({
    width: size.width,
    height: size.height,
    phi: rotation.phi,
    theta: rotation.theta,
    markers: [CURRENT_LOCATION, ...getGlobeDestinationMarkers(visibleDestinationIds)],
    arcs: getActiveArc(
      nextActiveDestination,
      getArcDrawProgress(now, arcAnimation, reduceMotion),
    ),
  });

  window.requestAnimationFrame(render);
}

window.requestAnimationFrame(render);
