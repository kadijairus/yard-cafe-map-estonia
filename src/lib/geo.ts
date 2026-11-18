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
