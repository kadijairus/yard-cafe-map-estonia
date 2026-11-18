import L from 'leaflet';
import {useEffect, useRef} from 'react';
import type {MapLocation, PlaceKind} from '../types/map';

interface CafeMapProps {
  locations: MapLocation[];
  selectedId: string | null;
  visitedIds: Set<string>;
  onSelectLocation: (location: MapLocation | null) => void;
}

const SIKUPILLI_CENTER: [number, number] = [59.4314, 24.7988];
const DEFAULT_ZOOM = 15;

const CHECKMARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createCafeCupHtml(nr: string, isSelected: boolean, isVisited: boolean): string {
  const selectedClass = isSelected
    ? 'scale-115 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
    : 'transition-transform duration-150 hover:scale-105';
  const safeNr = escapeHtml(nr);
  const fontSize = nr.length >= 3 ? 13 : 15;

  const cupInteriorSvg = isVisited
    ? `<ellipse cx="23" cy="13.5" rx="14" ry="5.3" fill="#CDB8A4" />
       <ellipse cx="23" cy="14.5" rx="13.2" ry="4.5" fill="#F3EAE0" />`
    : `<ellipse cx="23" cy="13.5" rx="14" ry="5.3" fill="#E8C38E" />
       <ellipse cx="23" cy="14.5" rx="12.8" ry="4.3" fill="#3F2312" />`;

  const checkmarkSvg = isVisited
    ? '<g transform="translate(31, 2)"><circle cx="8" cy="8" r="8" fill="#15803D" stroke="#FFFFFF" stroke-width="2" /><path d="M 4.5 8.2 L 7 10.6 L 11.5 5.6" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></g>'
    : '';

  return `<div class="relative flex w-[52px] items-center justify-center select-none ${selectedClass}">
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="58" viewBox="0 0 52 58" class="overflow-visible drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]" aria-hidden="true">
      <path d="M 13 38 L 23 53.5 L 33 38 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="4.5" stroke-linejoin="round" />
      <path d="M 38 20 C 48.5 19.5, 48.5 34.5, 36.5 34" fill="none" stroke="#FFFFFF" stroke-width="10.5" stroke-linecap="round" />
      <ellipse cx="23" cy="13.5" rx="17" ry="7.5" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="6" />
      <path d="M 6 13.5 C 6 33, 12 43.5, 23 43.5 C 34 43.5, 40 33, 40 13.5 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round" />
      <path d="M 38 20 C 48.5 19.5, 48.5 34.5, 36.5 34" fill="none" stroke="#FE5855" stroke-width="5" stroke-linecap="round" />
      <path d="M 6 13.5 C 6 33, 12 43.5, 23 43.5 C 34 43.5, 40 33, 40 13.5 Z" fill="#FE5855" />
      <ellipse cx="23" cy="13.5" rx="17" ry="7.5" fill="#FE5855" />
      ${cupInteriorSvg}
      <text x="23" y="32.5" text-anchor="middle" dominant-baseline="central" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700">${safeNr}</text>
      ${checkmarkSvg}
    </svg>
  </div>`;
}

function createLocationIcon(
  kind: PlaceKind,
  nr: string,
  isSelected: boolean,
  isVisited: boolean,
): L.DivIcon {
  if (kind === 'cafe') {
    return L.divIcon({
      html: createCafeCupHtml(nr, isSelected, isVisited),
      className: 'focus:outline-none',
      iconSize: [52, 58],
      iconAnchor: [23, 56],
    });
  }

  const selectedClass = isSelected
    ? 'scale-115 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
    : 'transition-transform duration-150 hover:scale-105';
  const safeNr = escapeHtml(nr);
  const textSizeClass = nr.length >= 3 ? 'text-[13px]' : 'text-[15px]';
  const labelHtml = `<span class="${textSizeClass} font-bold leading-none tracking-tight tabular-nums">${safeNr}</span>`;
  const visitedBadgeHtml = isVisited
    ? `<span class="absolute top-0 right-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#15803D] text-white shadow-sm">${CHECKMARK_SVG}</span>`
    : '';

  const html = `<div class="relative flex w-12 flex-col items-center pt-1 select-none ${selectedClass}"><div class="flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-white bg-[#980401] text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)]">${labelHtml}</div><div class="-mt-1.5 h-2.5 w-2.5 rotate-45 border-r-[3px] border-b-[3px] border-white bg-[#980401] shadow-[2px_2px_4px_rgba(0,0,0,0.25)]"></div>${visitedBadgeHtml}</div>`;

  return L.divIcon({
    html,
    className: 'focus:outline-none',
    iconSize: [48, 49],
    iconAnchor: [24, 48],
  });
}

export function CafeMap({
  locations,
  selectedId,
  visitedIds,
  onSelectLocation,
}: CafeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Record<string, {marker: L.Marker; kind: PlaceKind; nr: string}>>(
    {},
  );
  const onSelectRef = useRef(onSelectLocation);
  const hasFittedBoundsRef = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: SIKUPILLI_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      tapTolerance: 15,
    });

    L.control
      .zoom({
        position: 'bottomright',
        zoomInTitle: 'Suurenda',
        zoomOutTitle: 'Vähenda',
      })
      .addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(map);

    map.on('click', () => {
      onSelectRef.current(null);
    });

    const markersLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      markersByIdRef.current = {};
      hasFittedBoundsRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    markersByIdRef.current = {};

    if (locations.length === 0) {
      map.setView(SIKUPILLI_CENTER, DEFAULT_ZOOM);
      return;
    }

    const supportsHover =
      typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

    for (const item of locations) {
      const displayName = item.name || item.location || item.id;
      const marker = L.marker([item.lat, item.lng], {
        icon: createLocationIcon(
          item.kind,
          item.nr,
          item.id === selectedId,
          visitedIds.has(item.id),
        ),
        interactive: true,
        keyboard: true,
        title: displayName,
        alt: displayName,
      });

      if (supportsHover && displayName) {
        marker.bindTooltip(displayName, {
          direction: 'top',
          offset: [0, -48],
          opacity: 0.96,
        });
      }

      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current(item);
      });

      marker.addTo(markersLayer);
      markersByIdRef.current[item.id] = {marker, kind: item.kind, nr: item.nr};
    }

    if (!hasFittedBoundsRef.current) {
      const bounds = L.latLngBounds(
        locations.map((item) => [item.lat, item.lng] as [number, number]),
      );
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 88],
        paddingBottomRight: [40, 48],
        maxZoom: 16,
      });
      hasFittedBoundsRef.current = true;
    }
  }, [locations]);

  useEffect(() => {
    const entries = Object.entries(markersByIdRef.current);
    for (const [id, entry] of entries) {
      const isSelected = id === selectedId;
      const isVisited = visitedIds.has(id);
      entry.marker.setIcon(
        createLocationIcon(entry.kind, entry.nr, isSelected, isVisited),
      );
      entry.marker.setZIndexOffset(isSelected ? 500 : 0);
    }
  }, [selectedId, visitedIds]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Sikupilli hoovikohvikute kaart"
    />
  );
}
