import type {MapLocation} from '../types/map';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Straight-line (Haversine) distance in meters between two coordinates.
 */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export interface CafeDistanceEntry {
  cafe: MapLocation;
  distanceMeters: number;
}

export interface CafeDistanceDashboard {
  nearest: CafeDistanceEntry | null;
  farthest: CafeDistanceEntry | null;
}

export function getCafeDistanceDashboard(
  current: MapLocation,
  locations: MapLocation[],
  visitedIds: Set<string>,
): CafeDistanceDashboard {
  let nearest: CafeDistanceEntry | null = null;
  let farthest: CafeDistanceEntry | null = null;

  for (const candidate of locations) {
    if (candidate.kind !== 'cafe') continue;
    if (candidate.id === current.id) continue;
    if (visitedIds.has(candidate.id)) continue;

    const meters = Math.round(
      distanceMeters(current.lat, current.lng, candidate.lat, candidate.lng),
    );

    if (!nearest || meters < nearest.distanceMeters) {
      nearest = {cafe: candidate, distanceMeters: meters};
    }
    if (!farthest || meters > farthest.distanceMeters) {
      farthest = {cafe: candidate, distanceMeters: meters};
    }
  }

  return {nearest, farthest};
}

const CLUSTER_RADIUS_METERS = 200;

export interface CafeClusterSummary {
  cafes: MapLocation[];
  distanceMeters: number;
}

function compareByNr(a: MapLocation, b: MapLocation): number {
  const numA = Number(a.nr);
  const numB = Number(b.nr);
  const aIsNum = a.nr !== '' && Number.isFinite(numA);
  const bIsNum = b.nr !== '' && Number.isFinite(numB);
  if (aIsNum && bIsNum && numA !== numB) {
    return numA - numB;
  }
  const nrCmp = a.nr.localeCompare(b.nr, 'et', {numeric: true});
  if (nrCmp !== 0) return nrCmp;
  return a.name.localeCompare(b.name, 'et');
}

export function getLargestUnvisitedCluster(
  current: MapLocation,
  locations: MapLocation[],
  visitedIds: Set<string>,
): CafeClusterSummary | null {
  const unvisitedCafes = locations.filter(
    (item) => item.kind === 'cafe' && !visitedIds.has(item.id),
  );

  if (unvisitedCafes.length < 2) {
    return null;
  }

  const candidateCenters: Array<{lat: number; lng: number}> = unvisitedCafes.map(
    (cafe) => ({lat: cafe.lat, lng: cafe.lng}),
  );

  for (let i = 0; i < unvisitedCafes.length; i++) {
    for (let j = i + 1; j < unvisitedCafes.length; j++) {
      const a = unvisitedCafes[i];
      const b = unvisitedCafes[j];
      if (distanceMeters(a.lat, a.lng, b.lat, b.lng) <= CLUSTER_RADIUS_METERS * 2) {
        candidateCenters.push({
          lat: (a.lat + b.lat) / 2,
          lng: (a.lng + b.lng) / 2,
        });
      }
    }
  }

  let bestMembers: MapLocation[] | null = null;
  let bestDistance = Infinity;
  let bestSpread = Infinity;
  const seenSets = new Set<string>();

  for (const center of candidateCenters) {
    const members = unvisitedCafes.filter(
      (cafe) =>
        distanceMeters(center.lat, center.lng, cafe.lat, cafe.lng) <=
        CLUSTER_RADIUS_METERS,
    );

    if (members.length < 2) continue;

    const sorted = [...members].sort(compareByNr);
    const key = sorted.map((c) => c.id).join('|');
    if (seenSets.has(key)) continue;
    seenSets.add(key);

    const centroidLat =
      sorted.reduce((sum, cafe) => sum + cafe.lat, 0) / sorted.length;
    const centroidLng =
      sorted.reduce((sum, cafe) => sum + cafe.lng, 0) / sorted.length;
    const distFromCurrent = Math.round(
      distanceMeters(current.lat, current.lng, centroidLat, centroidLng),
    );
    const spread =
      sorted.reduce(
        (sum, cafe) =>
          sum + distanceMeters(centroidLat, centroidLng, cafe.lat, cafe.lng),
        0,
      ) / sorted.length;

    const isBetter =
      !bestMembers ||
      sorted.length > bestMembers.length ||
      (sorted.length === bestMembers.length &&
        (distFromCurrent < bestDistance ||
          (distFromCurrent === bestDistance && spread < bestSpread)));

    if (isBetter) {
      bestMembers = sorted;
      bestDistance = distFromCurrent;
      bestSpread = spread;
    }
  }

  if (!bestMembers) {
    return null;
  }

  return {
    cafes: bestMembers,
    distanceMeters: bestDistance,
  };
}
