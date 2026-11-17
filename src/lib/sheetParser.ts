import type {MapLocation, PlaceKind, RawSheetRow} from '../types/map';

/**
 * RFC 4180 compliant CSV parser supporting multiline quoted cells,
 * escaped quotes (""), CRLF/LF line endings, and UTF-8 BOM.
 */
export function parseCsvMatrix(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (ch === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseCoordinate(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function sanitizeHttpsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('https://')) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function csvToRawRows(csvText: string, kind: PlaceKind): RawSheetRow[] {
  if (!csvText.trim()) return [];
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) return [];

  const headerRow = matrix[0].map(normalizeHeader);
  const colIndex = (name: string): number => headerRow.indexOf(name);

  const idIdx = colIndex('id');
  const showIdx = colIndex('show on map');
  const latIdx = colIndex('lat');
  const lonIdx = colIndex('lon');
  const locationIdx = colIndex('location');
  const nameIdx = colIndex('name');
  const linkIdx = colIndex('event link');
  const descIdx = colIndex('description');
  const menuIdx = colIndex('menu');
  const openIdx = colIndex('open');

  if (idIdx === -1 || showIdx === -1 || latIdx === -1 || lonIdx === -1) {
    return [];
  }

  const getCell = (row: string[], index: number): string =>
    index >= 0 && index < row.length ? row[index] : '';

  const result: RawSheetRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    const hasAnyValue = row.some((cell) => cell.trim() !== '');
    if (!hasAnyValue) continue;

    result.push({
      id: getCell(row, idIdx),
      showOnMap: getCell(row, showIdx),
      lat: getCell(row, latIdx),
      lon: getCell(row, lonIdx),
      location: getCell(row, locationIdx),
      name: getCell(row, nameIdx),
      eventLink: getCell(row, linkIdx),
      description: getCell(row, descIdx),
      menu: kind === 'cafe' ? getCell(row, menuIdx) : '',
      open: getCell(row, openIdx),
      kind,
    });
  }

  return result;
}

export function parseLocations(rows: RawSheetRow[]): MapLocation[] {
  const seenIds: Record<string, true> = {};
  const result: MapLocation[] = [];

  for (const row of rows) {
    const id = row.id.trim();
    if (!id) continue;
    if (seenIds[id]) continue;

    if (row.showOnMap.trim() !== 'Yes') continue;

    const lat = parseCoordinate(row.lat);
    const lng = parseCoordinate(row.lon);
    if (lat === null || lng === null) continue;
    if (lat < 57.5 || lat > 59.9 || lng < 21.5 || lng > 28.3) continue;

    seenIds[id] = true;
    result.push({
      id,
      kind: row.kind,
      lat,
      lng,
      location: row.location.trim(),
      name: row.name.trim(),
      eventLink: sanitizeHttpsUrl(row.eventLink),
      description: row.description.trim(),
      menu: row.menu.trim(),
      open: row.open.trim(),
    });
  }

  return result;
}

export function parseSheetsPayload(cafesCsv: string, eventsCsv: string): MapLocation[] {
  const rawCafes = csvToRawRows(cafesCsv, 'cafe');
  const rawEvents = csvToRawRows(eventsCsv, 'event');
  return parseLocations([...rawCafes, ...rawEvents]);
}
