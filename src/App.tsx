import {
  useEffect,
  useMemo,
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
const DEFAULT_MARKER_SIZE = 0.04;
const CURRENT_LOCATION_MARKER_SIZE_RATIO = 0.07 / DEFAULT_MARKER_SIZE;
const AUTO_ROTATE_RADIANS_PER_SECOND = 0.22;
const DRAG_PHI_DIVISOR = 300;
const DRAG_THETA_DIVISOR = 1000;
const DRAG_MAX_VELOCITY = 0.15;
const DRAG_PHI_VELOCITY_SCALE = 0.3;
const DRAG_THETA_VELOCITY_SCALE = 0.08;
const DRAG_VELOCITY_DECAY = 0.95;
const DRAG_VELOCITY_STOP_THRESHOLD = 0.0001;
const DRAG_THETA_MIN = -0.4;
const DRAG_THETA_MAX = 0.4;
const DRAG_THETA_SPRING = 0.1;
const ROTATION_TRAVEL_MIN_DURATION_MS = 450;
const ROTATION_TRAVEL_MAX_DURATION_MS = 850;
const ROTATION_TRAVEL_MAX_DISTANCE = Math.PI;

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
  {
    id: "south-africa",
    label: "South Africa",
    location: [-30.5595, 22.9375],
    size: 0.04,
    labelOffset: [24, 12],
  },
  {
    id: "egypt",
    label: "Egypt",
    location: [26.8206, 30.8025],
    size: 0.04,
    labelOffset: [-28, -10],
  },
  {
    id: "kenya",
    label: "Kenya",
    location: [-0.0236, 37.9062],
    size: 0.04,
    labelOffset: [26, 10],
  },
  {
    id: "united-kingdom",
    label: "United Kingdom",
    location: [55.3781, -3.436],
    size: 0.04,
    labelOffset: [-38, -28],
  },
  {
    id: "france",
    label: "France",
    location: [46.2276, 2.2137],
    size: 0.04,
    labelOffset: [-44, -6],
  },
  {
    id: "germany",
    label: "Germany",
    location: [51.1657, 10.4515],
    size: 0.04,
    labelOffset: [34, -40],
  },
  {
    id: "spain",
    label: "Spain",
    location: [40.4637, -3.7492],
    size: 0.04,
    labelOffset: [-50, 20],
  },
  {
    id: "italy",
    label: "Italy",
    location: [41.8719, 12.5674],
    size: 0.04,
    labelOffset: [54, 18],
  },
  {
    id: "united-states",
    label: "United States",
    location: [37.0902, -95.7129],
    size: 0.04,
    labelOffset: [12, 24],
  },
  {
    id: "canada",
    label: "Canada",
    location: [56.1304, -106.3468],
    size: 0.04,
    labelOffset: [-34, -26],
  },
];

const CURRENT_LOCATION_OPTIONS: City[] = [
  CURRENT_LOCATION,
  ...DESTINATION_MARKERS,
];

type Scenario = {
  id: string;
  label: string;
  description: string;
  connectionMode: ConnectionMode;
};

type ConnectionMode = "single" | "visible" | "all";

const SCENARIOS: Scenario[] = [
  {
    id: "scenario-1",
    label: "Scenario 1",
    description: "Single connection",
    connectionMode: "single",
  },
  {
    id: "scenario-2",
    label: "Scenario 2",
    description: "Visible connections",
    connectionMode: "visible",
  },
  {
    id: "scenario-3",
    label: "Scenario 3",
    description: "All connections",
    connectionMode: "all",
  },
];

const DEFAULT_SCENARIO = SCENARIOS[0];

const INITIAL_ROTATION = {
  phi: 2.824,
  theta: 0.28,
};

type Rotation = typeof INITIAL_ROTATION;
type Location = [number, number];
type SpherePoint = [number, number, number];

type PointerSample = {
  x: number;
  y: number;
  t: number;
};

type DestinationCandidate = {
  marker: City;
  score: number;
};

type ArcAnimationState = {
  key: string | null;
  startedAt: number;
};

type RotationTravelState = {
  from: Rotation;
  to: Rotation;
  startedAt: number;
  durationMs: number;
};

type DestinationSelection = {
  activeDestination: City | null;
  activeDestinationId: string | null;
  visibleDestinationIds: string[];
};

type AppRoute = "portal" | "globe" | "prototype";
type GlobeSliderControlId = "markerSize" | "markerElevation" | "arcHeight" | "arcWidth";

type GlobeControlSettings = Record<GlobeSliderControlId, number> & {
  showMarkers: boolean;
  showArcs: boolean;
  autoRotate: boolean;
};

type GlobeToggleControlId = "showMarkers" | "showArcs" | "autoRotate";

type StandaloneGlobeSettings = GlobeControlSettings & {
  activeScenarioId: string;
  currentLocationId: string;
};

type SettingsPanelId = "location" | "scenario" | "controls";

type GlobeSliderControl = {
  id: GlobeSliderControlId;
  label: string;
  min: number;
  max: number;
  step: number;
  precision: number;
};

const DEFAULT_GLOBE_CONTROLS: GlobeControlSettings = {
  markerSize: DEFAULT_MARKER_SIZE,
  markerElevation: 0,
  arcHeight: 0.25,
  arcWidth: 0.4,
  showMarkers: true,
  showArcs: true,
  autoRotate: false,
};

const DEFAULT_STANDALONE_GLOBE_SETTINGS: StandaloneGlobeSettings = {
  activeScenarioId: DEFAULT_SCENARIO.id,
  currentLocationId: CURRENT_LOCATION.id,
  ...DEFAULT_GLOBE_CONTROLS,
};

const STANDALONE_GLOBE_SETTINGS_STORAGE_KEY = "cobe-globe:standalone-settings";

const GLOBE_SLIDER_CONTROLS: GlobeSliderControl[] = [
  { id: "markerSize", label: "markerSize", min: 0.005, max: 0.08, step: 0.001, precision: 3 },
  { id: "markerElevation", label: "markerElevation", min: 0, max: 0.08, step: 0.01, precision: 2 },
  { id: "arcHeight", label: "arcHeight", min: 0, max: 0.6, step: 0.01, precision: 2 },
  { id: "arcWidth", label: "arcWidth", min: 0.1, max: 1, step: 0.01, precision: 2 },
];

function getGlobeSliderControl(controlId: GlobeSliderControlId) {
  return GLOBE_SLIDER_CONTROLS.find((control) => control.id === controlId);
}

function clampGlobeControlValue(controlId: GlobeSliderControlId, value: number) {
  const control = getGlobeSliderControl(controlId);

  if (!control || !Number.isFinite(value)) {
    return DEFAULT_GLOBE_CONTROLS[controlId];
  }

  return Math.max(control.min, Math.min(control.max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getValidatedScenarioId(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_SCENARIO.id;
  }

  return SCENARIOS.some((scenario) => scenario.id === value) ? value : DEFAULT_SCENARIO.id;
}

function getValidatedCurrentLocationId(value: unknown) {
  if (typeof value !== "string") {
    return CURRENT_LOCATION.id;
  }

  return CURRENT_LOCATION_OPTIONS.some((location) => location.id === value)
    ? value
    : CURRENT_LOCATION.id;
}

function getValidatedToggleValue(controlId: GlobeToggleControlId, value: unknown) {
  return typeof value === "boolean" ? value : DEFAULT_GLOBE_CONTROLS[controlId];
}

function getValidatedSliderValue(controlId: GlobeSliderControlId, value: unknown) {
  return typeof value === "number"
    ? clampGlobeControlValue(controlId, value)
    : DEFAULT_GLOBE_CONTROLS[controlId];
}

function normalizeStandaloneGlobeSettings(value: unknown): StandaloneGlobeSettings {
  const source = isRecord(value) ? value : {};

  return {
    activeScenarioId: getValidatedScenarioId(source.activeScenarioId),
    currentLocationId: getValidatedCurrentLocationId(source.currentLocationId),
    markerSize: getValidatedSliderValue("markerSize", source.markerSize),
    markerElevation: getValidatedSliderValue("markerElevation", source.markerElevation),
    arcHeight: getValidatedSliderValue("arcHeight", source.arcHeight),
    arcWidth: getValidatedSliderValue("arcWidth", source.arcWidth),
    showMarkers: getValidatedToggleValue("showMarkers", source.showMarkers),
    showArcs: getValidatedToggleValue("showArcs", source.showArcs),
    autoRotate: getValidatedToggleValue("autoRotate", source.autoRotate),
  };
}

function readStandaloneGlobeSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_STANDALONE_GLOBE_SETTINGS;
  }

  try {
    const storedSettings = window.localStorage.getItem(STANDALONE_GLOBE_SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return DEFAULT_STANDALONE_GLOBE_SETTINGS;
    }

    return normalizeStandaloneGlobeSettings(JSON.parse(storedSettings));
  } catch {
    return DEFAULT_STANDALONE_GLOBE_SETTINGS;
  }
}

function writeStandaloneGlobeSettings(settings: StandaloneGlobeSettings) {
  try {
    window.localStorage.setItem(STANDALONE_GLOBE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

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

function getCenteredRotation(location: Location): Rotation {
  const [x, y, z] = toSpherePoint(location);

  return {
    phi: Math.atan2(-x, z),
    theta: Math.atan2(y, Math.hypot(x, z)),
  };
}

function getCurrentLocationById(locationId: string) {
  return CURRENT_LOCATION_OPTIONS.find((location) => location.id === locationId) ?? CURRENT_LOCATION;
}

function getDestinationMarkersForCurrentLocation(currentLocationId: string) {
  return CURRENT_LOCATION_OPTIONS.filter((location) => location.id !== currentLocationId);
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

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function getShortestAngleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function getShortestRotationTarget(from: Rotation, to: Rotation): Rotation {
  return {
    phi: from.phi + getShortestAngleDelta(from.phi, to.phi),
    theta: to.theta,
  };
}

function getRotationTravelDuration(from: Rotation, to: Rotation) {
  const distance = Math.hypot(
    getShortestAngleDelta(from.phi, to.phi),
    to.theta - from.theta,
  );
  const distanceRatio = Math.min(1, distance / ROTATION_TRAVEL_MAX_DISTANCE);

  return ROTATION_TRAVEL_MIN_DURATION_MS
    + (ROTATION_TRAVEL_MAX_DURATION_MS - ROTATION_TRAVEL_MIN_DURATION_MS) * distanceRatio;
}

function interpolateRotation(from: Rotation, to: Rotation, progress: number): Rotation {
  const easedProgress = easeInOutCubic(Math.max(0, Math.min(1, progress)));

  return {
    phi: from.phi + (to.phi - from.phi) * easedProgress,
    theta: from.theta + (to.theta - from.theta) * easedProgress,
  };
}

function getRotationWithDragOffset(rotation: Rotation, dragOffset: Rotation): Rotation {
  return {
    phi: rotation.phi + dragOffset.phi,
    theta: rotation.theta + dragOffset.theta,
  };
}

function clampVelocity(value: number) {
  return Math.max(-DRAG_MAX_VELOCITY, Math.min(DRAG_MAX_VELOCITY, value));
}

function applySoftThetaLimit(rotation: Rotation): Rotation {
  if (rotation.theta < DRAG_THETA_MIN) {
    return {
      ...rotation,
      theta: rotation.theta + (DRAG_THETA_MIN - rotation.theta) * DRAG_THETA_SPRING,
    };
  }

  if (rotation.theta > DRAG_THETA_MAX) {
    return {
      ...rotation,
      theta: rotation.theta + (DRAG_THETA_MAX - rotation.theta) * DRAG_THETA_SPRING,
    };
  }

  return rotation;
}

function hasActiveDragVelocity(velocity: Rotation) {
  return (
    Math.abs(velocity.phi) > DRAG_VELOCITY_STOP_THRESHOLD ||
    Math.abs(velocity.theta) > DRAG_VELOCITY_STOP_THRESHOLD
  );
}

function getArcDrawProgress(now: number, animation: ArcAnimationState, reduceMotion: boolean) {
  if (reduceMotion || !animation.key) {
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
  destinationMarkers = DESTINATION_MARKERS,
  previousActiveDestinationId?: string | null,
  visibleLimit = getVisibleDestinationLimit(),
): DestinationSelection {
  const candidates = destinationMarkers
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

function getDestinationById(destinationId: string, destinationMarkers = DESTINATION_MARKERS) {
  return destinationMarkers.find((destination) => destination.id === destinationId) ?? null;
}

function getDestinationsByIds(destinationIds: string[], destinationMarkers = DESTINATION_MARKERS) {
  return destinationIds
    .map((destinationId) => getDestinationById(destinationId, destinationMarkers))
    .filter((destination): destination is City => Boolean(destination));
}

function getConnectionDestinations(
  connectionMode: ConnectionMode,
  selection: DestinationSelection,
  destinationMarkers = DESTINATION_MARKERS,
) {
  if (connectionMode === "all") {
    return destinationMarkers;
  }

  if (connectionMode === "visible") {
    return getDestinationsByIds(selection.visibleDestinationIds, destinationMarkers);
  }

  return selection.activeDestination ? [selection.activeDestination] : [];
}

function getArcSetKey(
  connectionMode: ConnectionMode,
  selection: Pick<DestinationSelection, "activeDestinationId" | "visibleDestinationIds">,
  destinationMarkers = DESTINATION_MARKERS,
  currentLocation = CURRENT_LOCATION,
) {
  const originKey = currentLocation.id;

  if (connectionMode === "all") {
    return destinationMarkers.length > 0
      ? `${originKey}-to-all-${destinationMarkers.map((destination) => destination.id).join("-")}`
      : null;
  }

  if (connectionMode === "visible") {
    return selection.visibleDestinationIds.length > 0
      ? `${originKey}-to-visible-${selection.visibleDestinationIds.join("-")}`
      : null;
  }

  return selection.activeDestinationId ? `${originKey}-to-single-${selection.activeDestinationId}` : null;
}

function createConnectionArc(currentLocation: City, destination: City, progress = 1): Arc {
  return {
    id: `${currentLocation.id}-to-${destination.id}`,
    from: currentLocation.location,
    to: progress >= 1
      ? destination.location
      : interpolateLocation(currentLocation.location, destination.location, progress),
  };
}

function getConnectionArcs(
  connectionMode: ConnectionMode,
  selection: DestinationSelection,
  currentLocation = CURRENT_LOCATION,
  destinationMarkers = DESTINATION_MARKERS,
  progress = 1,
): Arc[] {
  return getConnectionDestinations(connectionMode, selection, destinationMarkers)
    .map((destination) => createConnectionArc(currentLocation, destination, progress));
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

function formatExportDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function createGlobeExportFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = formatExportDatePart(date.getMonth() + 1);
  const day = formatExportDatePart(date.getDate());
  const hours = formatExportDatePart(date.getHours());
  const minutes = formatExportDatePart(date.getMinutes());
  const seconds = formatExportDatePart(date.getSeconds());

  return `cobe-globe-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.png`;
}

function areSameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function getCurrentLocationMarker(currentLocation = CURRENT_LOCATION, markerSize = DEFAULT_MARKER_SIZE): City {
  return {
    ...currentLocation,
    size: markerSize * CURRENT_LOCATION_MARKER_SIZE_RATIO,
  };
}

function getGlobeDestinationMarkers(
  visibleDestinationIds: string[],
  markerSize = DEFAULT_MARKER_SIZE,
  destinationMarkers = DESTINATION_MARKERS,
) {
  const visibleIds = new Set(visibleDestinationIds);

  return destinationMarkers.map((marker) => {
    if (visibleIds.has(marker.id)) {
      return {
        ...marker,
        size: markerSize,
      };
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
  currentLocation = CURRENT_LOCATION,
  destinationMarkers = DESTINATION_MARKERS,
  showMarkers = true,
  showArcs = DEFAULT_GLOBE_CONTROLS.showArcs,
  markerSize = DEFAULT_GLOBE_CONTROLS.markerSize,
  markerElevation = DEFAULT_GLOBE_CONTROLS.markerElevation,
  arcHeight = DEFAULT_GLOBE_CONTROLS.arcHeight,
  arcWidth = DEFAULT_GLOBE_CONTROLS.arcWidth,
  autoRotate = DEFAULT_GLOBE_CONTROLS.autoRotate,
  connectionMode = DEFAULT_SCENARIO.connectionMode,
  renderPixelRatio,
  preserveDrawingBuffer = false,
  exportCanvasRef,
  recenterRequest = 0,
}: {
  className?: string;
  ariaLabel?: string;
  currentLocation?: City;
  destinationMarkers?: City[];
  showMarkers?: boolean;
  showArcs?: boolean;
  markerSize?: number;
  markerElevation?: number;
  arcHeight?: number;
  arcWidth?: number;
  autoRotate?: boolean;
  connectionMode?: ConnectionMode;
  renderPixelRatio?: number;
  preserveDrawingBuffer?: boolean;
  exportCanvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  recenterRequest?: number;
}) {
  const initialRotation = getCenteredRotation(currentLocation.location);
  const [visibleDestinationIds, setVisibleDestinationIds] = useState(
    () => getDestinationSelection(initialRotation, destinationMarkers).visibleDestinationIds,
  );
  const [activeDestinationId, setActiveDestinationId] = useState(
    () => getDestinationSelection(initialRotation, destinationMarkers).activeDestinationId,
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>();
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const sizeRef = useRef({ width: 900, height: 900 });
  const rotationRef = useRef(initialRotation);
  const currentLocationRef = useRef(currentLocation);
  const currentLocationIdRef = useRef(currentLocation.id);
  const destinationMarkersRef = useRef(destinationMarkers);
  const showMarkersRef = useRef(showMarkers);
  const showArcsRef = useRef(showArcs);
  const markerSizeRef = useRef(markerSize);
  const markerElevationRef = useRef(markerElevation);
  const arcHeightRef = useRef(arcHeight);
  const arcWidthRef = useRef(arcWidth);
  const autoRotateRef = useRef(autoRotate);
  const connectionModeRef = useRef(connectionMode);
  const visibleDestinationIdsRef = useRef(visibleDestinationIds);
  const activeDestinationIdRef = useRef(activeDestinationId);
  const arcAnimationRef = useRef<ArcAnimationState>({
    key: getArcSetKey(
      connectionMode,
      { activeDestinationId, visibleDestinationIds },
      destinationMarkers,
      currentLocation,
    ),
    startedAt: 0,
  });
  const rotationTravelRef = useRef<RotationTravelState | null>(null);
  const reduceMotionRef = useRef(false);
  const shouldLimitThetaRef = useRef(true);
  const didHandleInitialRecenterRef = useRef(false);
  const previousRenderAtRef = useRef(0);
  const dragOffsetRef = useRef<Rotation>({ phi: 0, theta: 0 });
  const velocityRef = useRef<Rotation>({ phi: 0, theta: 0 });
  const lastPointerRef = useRef<PointerSample | null>(null);
  const dragRef = useRef({
    active: false,
    pointerId: 0,
    x: 0,
    y: 0,
  });

  const startRotationTravel = (location: Location) => {
    const targetRotation = getCenteredRotation(location);
    const fromRotation = getRotationWithDragOffset(rotationRef.current, dragOffsetRef.current);
    const toRotation = getShortestRotationTarget(fromRotation, targetRotation);

    dragOffsetRef.current = { phi: 0, theta: 0 };
    velocityRef.current = { phi: 0, theta: 0 };
    shouldLimitThetaRef.current = false;

    if (reduceMotionRef.current) {
      rotationTravelRef.current = null;
      rotationRef.current = targetRotation;
      return;
    }

    rotationRef.current = fromRotation;
    rotationTravelRef.current = {
      from: fromRotation,
      to: toRotation,
      startedAt: performance.now(),
      durationMs: getRotationTravelDuration(fromRotation, toRotation),
    };
  };

  useEffect(() => {
    const previousCurrentLocationId = currentLocationIdRef.current;

    currentLocationRef.current = currentLocation;
    currentLocationIdRef.current = currentLocation.id;
    destinationMarkersRef.current = destinationMarkers;

    if (currentLocation.id !== previousCurrentLocationId) {
      startRotationTravel(currentLocation.location);
    }

    const renderedRotation = getRotationWithDragOffset(rotationRef.current, dragOffsetRef.current);
    const selection = getDestinationSelection(
      renderedRotation,
      destinationMarkers,
      activeDestinationIdRef.current,
    );

    if (!areSameIds(selection.visibleDestinationIds, visibleDestinationIdsRef.current)) {
      visibleDestinationIdsRef.current = selection.visibleDestinationIds;
      setVisibleDestinationIds(selection.visibleDestinationIds);
    }

    if (selection.activeDestinationId !== activeDestinationIdRef.current) {
      activeDestinationIdRef.current = selection.activeDestinationId;
      setActiveDestinationId(selection.activeDestinationId);
    }

    arcAnimationRef.current = {
      key: getArcSetKey(connectionModeRef.current, selection, destinationMarkers, currentLocation),
      startedAt: performance.now(),
    };
  }, [currentLocation, destinationMarkers]);

  useEffect(() => {
    if (!didHandleInitialRecenterRef.current) {
      didHandleInitialRecenterRef.current = true;
      return;
    }

    startRotationTravel(currentLocationRef.current.location);
  }, [recenterRequest]);

  useEffect(() => {
    showMarkersRef.current = showMarkers;
  }, [showMarkers]);

  useEffect(() => {
    markerSizeRef.current = markerSize;
  }, [markerSize]);

  useEffect(() => {
    markerElevationRef.current = markerElevation;
  }, [markerElevation]);

  useEffect(() => {
    arcHeightRef.current = arcHeight;
  }, [arcHeight]);

  useEffect(() => {
    arcWidthRef.current = arcWidth;
  }, [arcWidth]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    showArcsRef.current = showArcs;

    if (showArcs) {
      arcAnimationRef.current = {
        key: getArcSetKey(connectionModeRef.current, {
          activeDestinationId: activeDestinationIdRef.current,
          visibleDestinationIds: visibleDestinationIdsRef.current,
        }, destinationMarkersRef.current, currentLocationRef.current),
        startedAt: performance.now(),
      };
    }
  }, [showArcs]);

  useEffect(() => {
    connectionModeRef.current = connectionMode;
    arcAnimationRef.current = {
      key: getArcSetKey(connectionMode, {
        activeDestinationId: activeDestinationIdRef.current,
        visibleDestinationIds: visibleDestinationIdsRef.current,
      }, destinationMarkersRef.current, currentLocationRef.current),
      startedAt: performance.now(),
    };
  }, [connectionMode]);

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

      if (reducedMotionQuery.matches) {
        velocityRef.current = { phi: 0, theta: 0 };

        if (rotationTravelRef.current) {
          rotationRef.current = rotationTravelRef.current.to;
          rotationTravelRef.current = null;
        }
      }

      if (!reducedMotionQuery.matches) {
        arcAnimationRef.current = {
          key: getArcSetKey(connectionModeRef.current, {
            activeDestinationId: activeDestinationIdRef.current,
            visibleDestinationIds: visibleDestinationIdsRef.current,
          }, destinationMarkersRef.current, currentLocationRef.current),
          startedAt: performance.now(),
        };
      }
    };

    updateReducedMotionPreference();

    reducedMotionQuery.addEventListener("change", updateReducedMotionPreference);

    const startedAt = performance.now();
    previousRenderAtRef.current = startedAt;
    const initialSelection = getDestinationSelection(
      rotationRef.current,
      destinationMarkersRef.current,
      activeDestinationIdRef.current,
    );
    visibleDestinationIdsRef.current = initialSelection.visibleDestinationIds;
    activeDestinationIdRef.current = initialSelection.activeDestinationId;
    arcAnimationRef.current = {
      key: getArcSetKey(
        connectionModeRef.current,
        initialSelection,
        destinationMarkersRef.current,
        currentLocationRef.current,
      ),
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
          getCurrentLocationMarker(currentLocationRef.current, markerSizeRef.current),
          ...getGlobeDestinationMarkers(
            initialSelection.visibleDestinationIds,
            markerSizeRef.current,
            destinationMarkersRef.current,
          ),
        ]
        : [],
      arcs: showArcsRef.current
        ? getConnectionArcs(
          connectionModeRef.current,
          initialSelection,
          currentLocationRef.current,
          destinationMarkersRef.current,
          getArcDrawProgress(startedAt, arcAnimationRef.current, reduceMotionRef.current),
        )
        : [],
      arcColor: CONNECTOR_COLOR,
      arcWidth: arcWidthRef.current,
      arcHeight: arcHeightRef.current,
      markerElevation: markerElevationRef.current,
      scale: 1,
      offset: [0, 0],
      ...(preserveDrawingBuffer
        ? { context: { alpha: true, preserveDrawingBuffer: true } }
        : {}),
    });

    const render = () => {
      const now = performance.now();
      const elapsedSeconds = Math.min(0.05, (now - previousRenderAtRef.current) / 1000);
      previousRenderAtRef.current = now;
      let didTravelThisFrame = false;

      const rotationTravel = rotationTravelRef.current;

      if (rotationTravel && !dragRef.current.active) {
        didTravelThisFrame = true;
        velocityRef.current = { phi: 0, theta: 0 };

        if (reduceMotionRef.current) {
          rotationRef.current = rotationTravel.to;
          rotationTravelRef.current = null;
        } else {
          const travelProgress = Math.min(1, (now - rotationTravel.startedAt) / rotationTravel.durationMs);
          rotationRef.current = travelProgress >= 1
            ? rotationTravel.to
            : interpolateRotation(rotationTravel.from, rotationTravel.to, travelProgress);

          if (travelProgress >= 1) {
            rotationTravelRef.current = null;
          }
        }
      }

      if (
        autoRotateRef.current &&
        !dragRef.current.active &&
        !reduceMotionRef.current &&
        !didTravelThisFrame &&
        !rotationTravelRef.current
      ) {
        rotationRef.current = {
          ...rotationRef.current,
          phi: rotationRef.current.phi + AUTO_ROTATE_RADIANS_PER_SECOND * elapsedSeconds,
        };
      }

      if (!dragRef.current.active && !didTravelThisFrame && !rotationTravelRef.current) {
        if (reduceMotionRef.current) {
          velocityRef.current = { phi: 0, theta: 0 };

          if (shouldLimitThetaRef.current) {
            rotationRef.current = {
              ...rotationRef.current,
              theta: Math.max(DRAG_THETA_MIN, Math.min(DRAG_THETA_MAX, rotationRef.current.theta)),
            };
          }
        } else {
          if (hasActiveDragVelocity(velocityRef.current)) {
            shouldLimitThetaRef.current = true;
            rotationRef.current = {
              phi: rotationRef.current.phi + velocityRef.current.phi,
              theta: rotationRef.current.theta + velocityRef.current.theta,
            };
            velocityRef.current = {
              phi: velocityRef.current.phi * DRAG_VELOCITY_DECAY,
              theta: velocityRef.current.theta * DRAG_VELOCITY_DECAY,
            };
          } else {
            velocityRef.current = { phi: 0, theta: 0 };
          }

          if (shouldLimitThetaRef.current) {
            rotationRef.current = applySoftThetaLimit(rotationRef.current);
          }
        }
      }

      const renderedRotation = getRotationWithDragOffset(rotationRef.current, dragOffsetRef.current);

      const selection = getDestinationSelection(
        renderedRotation,
        destinationMarkersRef.current,
        activeDestinationIdRef.current,
      );

      if (!areSameIds(selection.visibleDestinationIds, visibleDestinationIdsRef.current)) {
        visibleDestinationIdsRef.current = selection.visibleDestinationIds;
        setVisibleDestinationIds(selection.visibleDestinationIds);
      }

      if (selection.activeDestinationId !== activeDestinationIdRef.current) {
        activeDestinationIdRef.current = selection.activeDestinationId;
        setActiveDestinationId(selection.activeDestinationId);
      }

      const nextArcSetKey = getArcSetKey(
        connectionModeRef.current,
        selection,
        destinationMarkersRef.current,
        currentLocationRef.current,
      );

      if (nextArcSetKey !== arcAnimationRef.current.key) {
        arcAnimationRef.current = {
          key: nextArcSetKey,
          startedAt: now,
        };
      }

      globeRef.current?.update({
        width: sizeRef.current.width,
        height: sizeRef.current.height,
        phi: renderedRotation.phi,
        theta: renderedRotation.theta,
        markers: showMarkersRef.current
          ? [
            getCurrentLocationMarker(currentLocationRef.current, markerSizeRef.current),
            ...getGlobeDestinationMarkers(
              selection.visibleDestinationIds,
              markerSizeRef.current,
              destinationMarkersRef.current,
            ),
          ]
          : [],
        arcs: showArcsRef.current
          ? getConnectionArcs(
            connectionModeRef.current,
            selection,
            currentLocationRef.current,
            destinationMarkersRef.current,
            getArcDrawProgress(now, arcAnimationRef.current, reduceMotionRef.current),
          )
          : [],
        arcWidth: arcWidthRef.current,
        arcHeight: arcHeightRef.current,
        markerElevation: markerElevationRef.current,
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
    rotationTravelRef.current = null;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    dragOffsetRef.current = { phi: 0, theta: 0 };
    velocityRef.current = { phi: 0, theta: 0 };
    lastPointerRef.current = null;
    shouldLimitThetaRef.current = true;

    stageRef.current?.setPointerCapture(event.pointerId);
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragOffsetRef.current = {
      phi: (event.clientX - dragState.x) / DRAG_PHI_DIVISOR,
      theta: (event.clientY - dragState.y) / DRAG_THETA_DIVISOR,
    };

    const now = performance.now();
    const lastPointer = lastPointerRef.current;

    if (lastPointer) {
      const elapsedMs = Math.max(now - lastPointer.t, 1);

      velocityRef.current = {
        phi: clampVelocity(((event.clientX - lastPointer.x) / elapsedMs) * DRAG_PHI_VELOCITY_SCALE),
        theta: clampVelocity(((event.clientY - lastPointer.y) / elapsedMs) * DRAG_THETA_VELOCITY_SCALE),
      };
    }

    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: now,
    };
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === event.pointerId && dragRef.current.active) {
      rotationRef.current = getRotationWithDragOffset(rotationRef.current, dragOffsetRef.current);
      dragOffsetRef.current = { phi: 0, theta: 0 };

      if (event.type !== "pointerup" || reduceMotionRef.current) {
        velocityRef.current = { phi: 0, theta: 0 };
        rotationRef.current = {
          ...rotationRef.current,
          theta: Math.max(DRAG_THETA_MIN, Math.min(DRAG_THETA_MAX, rotationRef.current.theta)),
        };
      }

      dragRef.current.active = false;
      lastPointerRef.current = null;
    }

    if (stageRef.current?.hasPointerCapture(event.pointerId)) {
      stageRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const visibleDestinationIdSet = new Set(visibleDestinationIds);
  const currentLocationLabelStyle = getLabelStyle(currentLocation);

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
          <span className="current-location-pulse" style={currentLocationLabelStyle} aria-hidden="true">
            <span className="current-location-pulse-ring" />
            <span className="current-location-pulse-ring" />
            <span className="current-location-pulse-dot" />
          </span>
          <span className="city-label current-location-label" style={currentLocationLabelStyle}>
            {currentLocation.label}
          </span>

          {destinationMarkers.map((city) => (
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

function formatGlobeControlValue(control: GlobeSliderControl, value: number) {
  return clampGlobeControlValue(control.id, value).toFixed(control.precision);
}

function GlobeOnlyPage() {
  const [standaloneSettings, setStandaloneSettings] = useState<StandaloneGlobeSettings>(readStandaloneGlobeSettings);
  const [openSettingsPanels, setOpenSettingsPanels] = useState<Record<SettingsPanelId, boolean>>({
    location: true,
    scenario: true,
    controls: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const standaloneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportUrlRef = useRef<string | null>(null);
  const globeControls: GlobeControlSettings = {
    markerSize: standaloneSettings.markerSize,
    markerElevation: standaloneSettings.markerElevation,
    arcHeight: standaloneSettings.arcHeight,
    arcWidth: standaloneSettings.arcWidth,
    showMarkers: standaloneSettings.showMarkers,
    showArcs: standaloneSettings.showArcs,
    autoRotate: standaloneSettings.autoRotate,
  };
  const currentLocation = getCurrentLocationById(standaloneSettings.currentLocationId);
  const destinationMarkers = useMemo(
    () => getDestinationMarkersForCurrentLocation(currentLocation.id),
    [currentLocation.id],
  );
  const activeScenarioId = standaloneSettings.activeScenarioId;
  const activeScenario = SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? DEFAULT_SCENARIO;

  useEffect(() => {
    return () => {
      if (exportUrlRef.current) {
        URL.revokeObjectURL(exportUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    writeStandaloneGlobeSettings(standaloneSettings);
  }, [standaloneSettings]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen]);

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
    link.download = createGlobeExportFilename();

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

  const toggleSettingsPanel = (panelId: SettingsPanelId) => {
    setOpenSettingsPanels((currentPanels) => ({
      ...currentPanels,
      [panelId]: !currentPanels[panelId],
    }));
  };

  const updateCurrentLocation = (locationId: string) => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      currentLocationId: getValidatedCurrentLocationId(locationId),
    }));
  };

  const resetCurrentLocation = () => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      currentLocationId: CURRENT_LOCATION.id,
    }));
  };

  const recenterCurrentLocation = () => {
    setRecenterRequest((currentRequest) => currentRequest + 1);
  };

  const updateScenario = (scenarioId: string) => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      activeScenarioId: getValidatedScenarioId(scenarioId),
    }));
  };

  const resetScenario = () => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      activeScenarioId: DEFAULT_SCENARIO.id,
    }));
  };

  const resetGlobeControls = () => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      ...DEFAULT_GLOBE_CONTROLS,
    }));
  };

  const updateGlobeSlider = (controlId: GlobeSliderControlId, value: number) => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      [controlId]: clampGlobeControlValue(controlId, value),
    }));
  };

  const resetGlobeSlider = (controlId: GlobeSliderControlId) => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      [controlId]: DEFAULT_GLOBE_CONTROLS[controlId],
    }));
  };

  const updateGlobeToggle = (controlId: GlobeToggleControlId, checked: boolean) => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      [controlId]: checked,
    }));
  };

  const resetGlobeToggle = (controlId: GlobeToggleControlId) => {
    setStandaloneSettings((currentSettings) => ({
      ...currentSettings,
      [controlId]: DEFAULT_GLOBE_CONTROLS[controlId],
    }));
  };

  return (
    <main
      className={`standalone-globe-page${isSettingsOpen ? " is-settings-open" : ""}`}
      aria-label="Globe only"
    >
      <button
        className="standalone-settings-menu-button"
        type="button"
        aria-label="Open settings"
        aria-controls="standalone-settings-panel"
        aria-expanded={isSettingsOpen}
        onClick={() => setIsSettingsOpen(true)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <button
        className="standalone-settings-backdrop"
        type="button"
        aria-label="Close settings"
        onClick={() => setIsSettingsOpen(false)}
      />

      <div className="standalone-globe-layout">
        <section className="standalone-globe-view" aria-label="Interactive globe preview">
          <div className="standalone-globe-frame">
            <CobeGlobe
              className="standalone-globe-stage"
              ariaLabel="Draggable standalone COBE globe"
              currentLocation={currentLocation}
              destinationMarkers={destinationMarkers}
              markerSize={globeControls.markerSize}
              markerElevation={globeControls.markerElevation}
              arcHeight={globeControls.arcHeight}
              arcWidth={globeControls.arcWidth}
              showMarkers={globeControls.showMarkers}
              showArcs={globeControls.showArcs}
              autoRotate={globeControls.autoRotate}
              connectionMode={activeScenario.connectionMode}
              renderPixelRatio={2}
              preserveDrawingBuffer
              exportCanvasRef={standaloneCanvasRef}
              recenterRequest={recenterRequest}
            />
          </div>
        </section>

        <section
          id="standalone-settings-panel"
          className="standalone-settings-panel"
          aria-labelledby="standalone-settings-heading"
        >
          <div className="standalone-settings-header">
            <h1 id="standalone-settings-heading">Settings</h1>
            <button
              className="standalone-settings-close-button"
              type="button"
              aria-label="Close settings"
              onClick={() => setIsSettingsOpen(false)}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>

          <section className="standalone-settings-group standalone-location-section">
            <div className="standalone-settings-group-header">
              <button
                id="standalone-location-heading"
                className="standalone-settings-group-toggle"
                type="button"
                aria-expanded={openSettingsPanels.location}
                aria-controls="standalone-location-panel"
                onClick={() => toggleSettingsPanel("location")}
              >
                <span>Current Location</span>
                <span className="standalone-settings-group-chevron" aria-hidden="true" />
              </button>
              <button
                className="standalone-setting-reset-button"
                type="button"
                aria-label="Reset Current Location to default"
                title="Reset Current Location"
                onClick={resetCurrentLocation}
              />
            </div>
            <div
              id="standalone-location-panel"
              className="standalone-settings-group-body"
              role="region"
              aria-labelledby="standalone-location-heading"
              hidden={!openSettingsPanels.location}
            >
              <label className="standalone-scenario-select-control" htmlFor="standalone-current-location-select">
                <span>Country</span>
                <span className="standalone-scenario-select-wrap">
                  <select
                    id="standalone-current-location-select"
                    value={currentLocation.id}
                    onChange={(event) => updateCurrentLocation(event.currentTarget.value)}
                  >
                    {CURRENT_LOCATION_OPTIONS.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <button className="standalone-recenter-button" type="button" onClick={recenterCurrentLocation}>
                Re-center globe
              </button>
            </div>
          </section>

          <section className="standalone-settings-group standalone-scenario-section">
            <div className="standalone-settings-group-header">
              <button
                id="standalone-scenario-heading"
                className="standalone-settings-group-toggle"
                type="button"
                aria-expanded={openSettingsPanels.scenario}
                aria-controls="standalone-scenario-panel"
                onClick={() => toggleSettingsPanel("scenario")}
              >
                <span>Scenario</span>
                <span className="standalone-settings-group-chevron" aria-hidden="true" />
              </button>
              <button
                className="standalone-setting-reset-button"
                type="button"
                aria-label="Reset Scenario to default"
                title="Reset Scenario"
                onClick={resetScenario}
              />
            </div>
            <div
              id="standalone-scenario-panel"
              className="standalone-settings-group-body"
              role="region"
              aria-labelledby="standalone-scenario-heading"
              hidden={!openSettingsPanels.scenario}
            >
              <label className="standalone-scenario-select-control" htmlFor="standalone-scenario-select">
                <span>Scenario</span>
                <span className="standalone-scenario-select-wrap">
                  <select
                    id="standalone-scenario-select"
                    value={activeScenarioId}
                    onChange={(event) => updateScenario(event.currentTarget.value)}
                  >
                    {SCENARIOS.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.label} - {scenario.description}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
          </section>

          <section className="standalone-settings-group standalone-control-section">
            <div className="standalone-settings-group-header">
              <button
                id="standalone-controls-heading"
                className="standalone-settings-group-toggle"
                type="button"
                aria-expanded={openSettingsPanels.controls}
                aria-controls="standalone-controls-panel"
                onClick={() => toggleSettingsPanel("controls")}
              >
                <span>Controls</span>
                <span className="standalone-settings-group-chevron" aria-hidden="true" />
              </button>
              <button
                className="standalone-control-reset-button"
                type="button"
                onClick={resetGlobeControls}
              >
                Reset
              </button>
            </div>
            <div
              id="standalone-controls-panel"
              className="standalone-settings-group-body"
              role="region"
              aria-labelledby="standalone-controls-heading"
              hidden={!openSettingsPanels.controls}
            >
              <div className="standalone-slider-list">
                {GLOBE_SLIDER_CONTROLS.map((control) => (
                  <div className="standalone-slider-control" key={control.id}>
                    <div className="standalone-slider-copy">
                      <span className="standalone-setting-label-row">
                        <label htmlFor={`standalone-${control.id}`}>{control.label}</label>
                        <button
                          className="standalone-setting-reset-button"
                          type="button"
                          aria-label={`Reset ${control.label} to default`}
                          title={`Reset ${control.label}`}
                          onClick={() => resetGlobeSlider(control.id)}
                        />
                      </span>
                      <span className="standalone-slider-value">
                        {formatGlobeControlValue(control, globeControls[control.id])}
                      </span>
                    </div>
                    <input
                      id={`standalone-${control.id}`}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={clampGlobeControlValue(control.id, globeControls[control.id])}
                      onChange={(event) => updateGlobeSlider(control.id, event.currentTarget.valueAsNumber)}
                    />
                  </div>
                ))}
              </div>

              <div className="standalone-toggle-list">
                <div className="standalone-toggle-setting">
                  <label className="standalone-control-toggle">
                    <input
                      type="checkbox"
                      checked={globeControls.showMarkers}
                      onChange={(event) => updateGlobeToggle("showMarkers", event.currentTarget.checked)}
                    />
                    <span>Show Markers</span>
                  </label>
                  <button
                    className="standalone-setting-reset-button"
                    type="button"
                    aria-label="Reset Show Markers to default"
                    title="Reset Show Markers"
                    onClick={() => resetGlobeToggle("showMarkers")}
                  />
                </div>
                <div className="standalone-toggle-setting">
                  <label className="standalone-control-toggle">
                    <input
                      type="checkbox"
                      checked={globeControls.showArcs}
                      onChange={(event) => updateGlobeToggle("showArcs", event.currentTarget.checked)}
                    />
                    <span>Show Arcs</span>
                  </label>
                  <button
                    className="standalone-setting-reset-button"
                    type="button"
                    aria-label="Reset Show Arcs to default"
                    title="Reset Show Arcs"
                    onClick={() => resetGlobeToggle("showArcs")}
                  />
                </div>
                <div className="standalone-toggle-setting">
                  <label className="standalone-control-toggle">
                    <input
                      type="checkbox"
                      checked={globeControls.autoRotate}
                      onChange={(event) => updateGlobeToggle("autoRotate", event.currentTarget.checked)}
                    />
                    <span>Auto Rotate</span>
                  </label>
                  <button
                    className="standalone-setting-reset-button"
                    type="button"
                    aria-label="Reset Auto Rotate to default"
                    title="Reset Auto Rotate"
                    onClick={() => resetGlobeToggle("autoRotate")}
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="standalone-globe-controls" aria-label="Globe export controls">
            <a
              className="standalone-export-button"
              href="#"
              download={createGlobeExportFilename()}
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
        </section>
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
