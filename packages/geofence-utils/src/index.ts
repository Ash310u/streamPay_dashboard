export interface Coordinates {
  lat: number;
  lng: number;
}

export interface CircleGeofence {
  type: "circle";
  center: Coordinates;
  radiusMeters: number;
}

export interface PolygonGeofence {
  type: "polygon";
  coordinates: Array<[number, number]>;
}

export type AnyGeofence = CircleGeofence | PolygonGeofence;

const EARTH_RADIUS_METERS = 6371000;

export const haversineDistanceMeters = (a: Coordinates, b: Coordinates): number => {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const value =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export const isPointInsideCircle = (point: Coordinates, geofence: CircleGeofence): boolean => {
  return haversineDistanceMeters(point, geofence.center) <= geofence.radiusMeters;
};

export const isPointInsidePolygon = (point: Coordinates, coordinates: Array<[number, number]>): boolean => {
  let isInside = false;

  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const [latI, lngI] = coordinates[i];
    const [latJ, lngJ] = coordinates[j];

    const intersects =
      lngI > point.lng !== lngJ > point.lng &&
      point.lat < ((latJ - latI) * (point.lng - lngI)) / (lngJ - lngI) + latI;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

export const isPointInsideGeofence = (point: Coordinates, geofence: AnyGeofence): boolean => {
  if (geofence.type === "circle") {
    return isPointInsideCircle(point, geofence);
  }

  return isPointInsidePolygon(point, geofence.coordinates);
};

