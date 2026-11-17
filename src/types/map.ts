export type PlaceKind = 'cafe' | 'event';

export interface RawSheetRow {
  id: string;
  showOnMap: string;
  lat: string;
  lon: string;
  location: string;
  name: string;
  eventLink: string;
  description: string;
  menu: string;
  open: string;
  kind: PlaceKind;
}

export interface MapLocation {
  id: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  location: string;
  name: string;
  eventLink: string;
  description: string;
  menu: string;
  open: string;
}
