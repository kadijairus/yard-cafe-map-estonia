import L from 'leaflet';
import {useEffect, useRef} from 'react';
import type {MapLocation, PlaceKind} from '../types/map';

interface CafeMapProps {
  locations: MapLocation[];
  selectedId: string | null;
  onSelectLocation: (location: MapLocation | null) => void;
}

const SIKUPILLI_CENTER: [number, number] = [59.4314, 24.7988];
const DEFAULT_ZOOM = 15;

const CAFE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>';

const EVENT_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';

function createLocationIcon(kind: PlaceKind, isSelected: boolean): L.DivIcon {
  const ringClass = isSelected
    ? 'ring-4 ring-slate-950/35 scale-110'
    : 'transition-transform duration-150 hover:scale-105';

  const html =
    kind === 'cafe'
      ? `<div class="flex w-11 flex-col items-center select-none ${ringClass}"><div class="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-[#FE5855] text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)]">${CAFE_ICON_SVG}</div><div class="-mt-1.5 h-2.5 w-2.5 rotate-45 border-r-[3px] border-b-[3px] border-white bg-[#FE5855] shadow-[2px_2px_4px_rgba(0,0,0,0.25)]"></div></div>`
      : `<div class="flex w-11 flex-col items-center select-none ${ringClass}"><div class="flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-white bg-[#980401] text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)]">${EVENT_ICON_SVG}</div><div class="-mt-1.5 h-2.5 w-2.5 rotate-45 border-r-[3px] border-b-[3px] border-white bg-[#980401] shadow-[2px_2px_4px_rgba(0,0,0,0.25)]"></div></div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [44, 46],
    iconAnchor: [22, 45],
  });
}

export function CafeMap({locations, selectedId, onSelectLocation}: CafeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Record<string, {marker: L.Marker; kind: PlaceKind}>>({});
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
        icon: createLocationIcon(item.kind, item.id === selectedId),
        interactive: true,
        keyboard: true,
        title: displayName,
        alt: displayName,
      });

      if (supportsHover && displayName) {
        marker.bindTooltip(displayName, {
          direction: 'top',
          offset: [0, -46],
          opacity: 0.96,
        });
      }

      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current(item);
      });

      marker.addTo(markersLayer);
      markersByIdRef.current[item.id] = {marker, kind: item.kind};
    }

    if (!hasFittedBoundsRef.current) {
      const bounds = L.latLngBounds(
        locations.map((item) => [item.lat, item.lng] as [number, number]),
      );
      map.fitBounds(bounds, {
        padding: [48, 48],
        maxZoom: 16,
      });
      hasFittedBoundsRef.current = true;
    }
  }, [locations]);

  useEffect(() => {
    const entries = Object.entries(markersByIdRef.current);
    for (const [id, entry] of entries) {
      entry.marker.setIcon(createLocationIcon(entry.kind, id === selectedId));
      entry.marker.setZIndexOffset(id === selectedId ? 500 : 0);
    }
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Sikupilli hoovikohvikute kaart"
    />
  );
}
