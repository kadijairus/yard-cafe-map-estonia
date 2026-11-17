import {Clock, ExternalLink, MapPin, X} from 'lucide-react';
import {useEffect} from 'react';
import type {MapLocation} from '../types/map';

interface LocationCardProps {
  item: MapLocation;
  onClose: () => void;
}

export function LocationCard({item, onClose}: LocationCardProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const kindLabel = item.kind === 'cafe' ? 'Kohvik' : 'Tegevus';
  const title = item.name || item.location || item.id;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="location-card-title"
      className="fixed inset-x-0 bottom-0 z-[1000] flex max-h-[75dvh] flex-col rounded-t-3xl bg-white text-slate-950 shadow-[0_-8px_32px_rgba(0,0,0,0.22)] md:inset-x-auto md:bottom-4 md:left-4 md:max-h-[calc(100dvh-2rem)] md:w-[390px] md:rounded-2xl md:border md:border-slate-200 md:shadow-xl"
    >
      <div className="flex justify-center pt-2.5 pb-1 md:hidden" aria-hidden="true">
        <div className="h-1.5 w-10 rounded-full bg-slate-300" />
      </div>

      <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 md:pt-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{kindLabel}</p>
          <h2
            id="location-card-title"
            className="mt-0.5 text-xl font-bold leading-snug text-slate-950"
          >
            {title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Sulge"
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <X size={22} strokeWidth={2.2} />
        </button>
      </div>

      <div className="overflow-y-auto px-5 pb-6">
        {(item.location || item.open) && (
          <div className="space-y-2 border-t border-slate-100 pt-3 text-[15px] text-slate-800">
            {item.location && (
              <div className="flex items-start gap-2.5">
                <MapPin
                  size={18}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span>{item.location}</span>
              </div>
            )}

            {item.open && (
              <div className="flex items-start gap-2.5">
                <Clock
                  size={18}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span className="tabular-nums">{item.open}</span>
              </div>
            )}
          </div>
        )}

        {item.description && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
              {item.description}
            </p>
          </div>
        )}

        {item.menu && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500">Menüü</h3>
            <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-slate-900">
              {item.menu}
            </p>
          </div>
        )}

        {item.eventLink && (
          <div className="mt-5">
            <a
              href={item.eventLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <span>Ürituse link</span>
              <ExternalLink size={17} strokeWidth={2.2} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
