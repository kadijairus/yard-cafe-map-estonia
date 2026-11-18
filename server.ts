import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const CACHE_TTL_MS = 60_000; // 1 minute cache (well under 5-minute refresh target)
const FETCH_TIMEOUT_MS = 6_000;

interface CachedSheetsPayload {
  cafesCsv: string;
  eventsCsv: string;
  fetchedAt: number;
  source: 'google-sheet' | 'bundled-csv';
}

let cachedPayload: CachedSheetsPayload | null = null;

function normalizeSheetCsvUrl(rawUrl: string, sheetName: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Already a CSV export or published CSV link
  if (
    trimmed.includes('output=csv') ||
    trimmed.includes('format=csv') ||
    trimmed.includes('tqx=out:csv')
  ) {
    return trimmed;
  }

  // Convert standard Google Sheets sharing URL (/spreadsheets/d/<ID>/...) to gviz CSV export
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const sheetId = match[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }

  return trimmed;
}

const DEFAULT_GOOGLE_SHEET_ID = '1TmILaYGr591-WzKepEbETRjI-iuwNyY62_Aqg1sfgIs';

function extractSheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match && match[1] ? match[1] : input;
}

async function fetchSheetGids(sheetId: string): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/htmlview`;
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const gids: Record<string, string> = {};
    const pattern = /items\.push\(\{name:\s*"([^"]+)"[^}]*?gid:\s*"([0-9]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      gids[match[1]] = match[2];
    }
    return gids;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveCsvUrlsFromEnv(): Promise<{cafesUrl: string; eventsUrl: string}> {
  const rawCafes = process.env.GOOGLE_SHEET_CAFES_URL?.trim() || '';
  const rawEvents = process.env.GOOGLE_SHEET_EVENTS_URL?.trim() || '';
  const rawSheetId = process.env.GOOGLE_SHEET_ID?.trim() || DEFAULT_GOOGLE_SHEET_ID;
  const sheetId = rawSheetId ? extractSheetId(rawSheetId) : '';

  if (rawCafes || rawEvents) {
    return {
      cafesUrl: rawCafes ? normalizeSheetCsvUrl(rawCafes, 'Kohvikud') : '',
      eventsUrl: rawEvents ? normalizeSheetCsvUrl(rawEvents, 'Tegevused') : '',
    };
  }

  if (!sheetId) {
    return {cafesUrl: '', eventsUrl: ''};
  }

  const gids = await fetchSheetGids(sheetId);
  const cafesUrl = gids['Kohvikud']
    ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gids['Kohvikud'])}`
    : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=Kohvikud`;
  const eventsUrl = gids['Tegevused']
    ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gids['Tegevused'])}`
    : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=Tegevused`;

  return {cafesUrl, eventsUrl};
}

async function fetchCsvText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/csv,text/plain,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const trimmedStart = text.trimStart().toLowerCase();
    if (trimmedStart.startsWith('<!doctype') || trimmedStart.startsWith('<html')) {
      throw new Error('Sheet returned HTML instead of CSV (check public sharing settings)');
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function loadBundledCsv(): Promise<string> {
  const filePath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/Kohvikute_kaardi_sisend_2b3cb6c3',
  );
  return fs.readFile(filePath, 'utf8');
}

async function startServer() {
  const app = express();

  app.get('/api/locations', async (req, res) => {
    const forceRefresh = req.query.refresh === '1';
    const now = Date.now();

    if (!forceRefresh && cachedPayload && now - cachedPayload.fetchedAt < CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(cachedPayload);
      return;
    }

    try {
      const {cafesUrl, eventsUrl} = await resolveCsvUrlsFromEnv();

      if (!cafesUrl && !eventsUrl) {
        const cafesCsv = await loadBundledCsv();
        const payload: CachedSheetsPayload = {
          cafesCsv,
          eventsCsv: '',
          fetchedAt: now,
          source: 'bundled-csv',
        };
        cachedPayload = payload;
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.json(payload);
        return;
      }

      const [cafesCsv, eventsCsv] = await Promise.all([
        cafesUrl ? fetchCsvText(cafesUrl) : Promise.resolve(''),
        eventsUrl ? fetchCsvText(eventsUrl) : Promise.resolve(''),
      ]);

      const payload: CachedSheetsPayload = {
        cafesCsv,
        eventsCsv,
        fetchedAt: now,
        source: 'google-sheet',
      };
      cachedPayload = payload;
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(payload);
    } catch {
      res.status(502).json({error: 'Kaarti ei õnnestunud uuendada'});
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
