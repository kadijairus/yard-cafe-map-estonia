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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createLocationIcon(kind: PlaceKind, nr: string, isSelected: boolean): L.DivIcon {
  const ringClass = isSelected
    ? 'ring-4 ring-slate-950/35 scale-110'
    : 'transition-transform duration-150 hover:scale-105';
  const safeNr = escapeHtml(nr);
  const textSizeClass = nr.length >= 3 ? 'text-[13px]' : 'text-[15px]';
  const labelHtml = `<span class="${textSizeClass} font-bold leading-none tracking-tight tabular-nums">${safeNr}</span>`;

  const html =
    kind === 'cafe'
      ? `<div class="flex w-11 flex-col items-center select-none ${ringClass}"><div class="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-[#FE5855] text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)]">${labelHtml}</div><div class="-mt-1.5 h-2.5 w-2.5 rotate-45 border-r-[3px] border-b-[3px] border-white bg-[#FE5855] shadow-[2px_2px_4px_rgba(0,0,0,0.25)]"></div></div>`
      : `<div class="flex w-11 flex-col items-center select-none ${ringClass}"><div class="flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-white bg-[#980401] text-white shadow-[0_3px_10px_rgba(0,0,0,0.45)]">${labelHtml}</div><div class="-mt-1.5 h-2.5 w-2.5 rotate-45 border-r-[3px] border-b-[3px] border-white bg-[#980401] shadow-[2px_2px_4px_rgba(0,0,0,0.25)]"></div></div>`;

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
        icon: createLocationIcon(item.kind, item.nr, item.id === selectedId),
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
      markersByIdRef.current[item.id] = {marker, kind: item.kind, nr: item.nr};
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
      entry.marker.setIcon(createLocationIcon(entry.kind, entry.nr, id === selectedId));
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
