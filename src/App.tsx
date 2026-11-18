import {RefreshCw} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {CafeMap} from './components/CafeMap';
import {LocationCard} from './components/LocationCard';
import {ProgressBars} from './components/ProgressBars';
import {parseSheetsPayload} from './lib/sheetParser';
import type {MapLocation} from './types/map';

const STORAGE_CACHE_KEY = 'sikupilli_sheet_cache_v1';
const STORAGE_VISITED_KEY = 'sikupilli_visited_ids_v1';

interface SavedSheetCache {
  cafesCsv: string;
  eventsCsv: string;
  savedAt: number;
}

interface LocationsApiResponse {
  cafesCsv: string;
  eventsCsv: string;
  fetchedAt: number;
  source: 'google-sheet' | 'bundled-csv';
}

function readSavedCache(): SavedSheetCache | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSheetCache>;
    if (typeof parsed.cafesCsv !== 'string' || typeof parsed.eventsCsv !== 'string') {
      return null;
    }
    return {
      cafesCsv: parsed.cafesCsv,
      eventsCsv: parsed.eventsCsv,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeSavedCache(cache: SavedSheetCache): void {
  try {
    window.localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function readVisitedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_VISITED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

function writeVisitedIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_VISITED_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export default function App() {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => readVisitedIds());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [usingSavedCopy, setUsingSavedCopy] = useState<boolean>(false);
  const [hasFatalError, setHasFatalError] = useState<boolean>(false);

  const loadLocations = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setHasFatalError(false);

    try {
      const url = forceRefresh ? '/api/locations?refresh=1' : '/api/locations';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as LocationsApiResponse;
      const parsed = parseSheetsPayload(data.cafesCsv || '', data.eventsCsv || '');

      if (parsed.length === 0) {
        throw new Error('No valid locations returned');
      }

      setLocations(parsed);
      setUsingSavedCopy(false);
      setHasFatalError(false);
      writeSavedCache({
        cafesCsv: data.cafesCsv || '',
        eventsCsv: data.eventsCsv || '',
        savedAt: Date.now(),
      });
    } catch {
      const saved = readSavedCache();
      if (saved) {
        const cachedLocations = parseSheetsPayload(saved.cafesCsv, saved.eventsCsv);
        if (cachedLocations.length > 0) {
          setLocations(cachedLocations);
          setUsingSavedCopy(true);
          setHasFatalError(false);
          setIsLoading(false);
          return;
        }
      }

      setLocations([]);
      setUsingSavedCopy(false);
      setHasFatalError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocations(false);
  }, [loadLocations]);

  const selectedLocation = useMemo(
    () => locations.find((item) => item.id === selectedId) ?? null,
    [locations, selectedId],
  );

  const progressStats = useMemo(() => {
    let cafesTotal = 0;
    let cafesVisited = 0;
    let eventsTotal = 0;
    let eventsVisited = 0;

    for (const item of locations) {
      const isVisited = visitedIds.has(item.id);
      if (item.kind === 'cafe') {
        cafesTotal++;
        if (isVisited) cafesVisited++;
      } else {
        eventsTotal++;
        if (isVisited) eventsVisited++;
      }
    }

    return {cafesVisited, cafesTotal, eventsVisited, eventsTotal};
  }, [locations, visitedIds]);

  const handleSelectLocation = useCallback((item: MapLocation | null) => {
    setSelectedId(item ? item.id : null);
  }, []);

  const handleCloseCard = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleToggleVisited = useCallback((id: string) => {
    setVisitedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      writeVisitedIds(next);
      return next;
    });
  }, []);

  if (hasFatalError && locations.length === 0) {
    return (
      <main className="flex h-dvh w-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-950">
            Kaarti ei õnnestunud uuendada
          </h1>
          <button
            type="button"
            onClick={() => void loadLocations(true)}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Proovi uuesti</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#F2EFE9]">
      <CafeMap
        locations={locations}
        selectedId={selectedId}
        visitedIds={visitedIds}
        onSelectLocation={handleSelectLocation}
      />

      <div className="pointer-events-none fixed inset-x-2.5 top-2.5 z-[900] flex flex-col gap-2 md:right-auto md:left-4 md:top-4 md:w-[340px]">
        <ProgressBars
          cafesVisited={progressStats.cafesVisited}
          cafesTotal={progressStats.cafesTotal}
          eventsVisited={progressStats.eventsVisited}
          eventsTotal={progressStats.eventsTotal}
        />

        {usingSavedCopy && (
          <div
            role="status"
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-950 shadow-md"
          >
            <span className="truncate">Kaarti ei õnnestunud uuendada</span>
            <button
              type="button"
              onClick={() => void loadLocations(true)}
              disabled={isLoading}
              className="min-h-[36px] shrink-0 rounded-lg bg-amber-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-800 disabled:opacity-60"
            >
              Uuenda
            </button>
          </div>
        )}
      </div>

      {selectedLocation && (
        <LocationCard
          item={selectedLocation}
          isVisited={visitedIds.has(selectedLocation.id)}
          onToggleVisited={handleToggleVisited}
          onClose={handleCloseCard}
        />
      )}
    </main>
  );
}
