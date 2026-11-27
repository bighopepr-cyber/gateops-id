export type GpsMapPoint = { id: string; latitude: number; longitude: number };
export type GpsMapTile = { key: string; url: string; left: number; top: number };
export type GpsMapMarker = { id: string; left: number; top: number };
export type GpsMapLayout = { zoom: number; tiles: GpsMapTile[]; markers: GpsMapMarker[] };

const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;

function project(latitude: number, longitude: number, zoom: number) {
  const boundedLatitude = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude));
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((boundedLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  };
}

export function createGpsMapLayout(points: GpsMapPoint[], width: number, height: number, zoomAdjustment = 0): GpsMapLayout {
  if (!points.length || width <= 0 || height <= 0) return { zoom: 0, tiles: [], markers: [] };

  const normalized = points.map(point => ({
    id: point.id,
    latitude: Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.latitude)),
    longitude: Math.max(-180, Math.min(180, point.longitude))
  }));
  const minLatitude = Math.min(...normalized.map(point => point.latitude));
  const maxLatitude = Math.max(...normalized.map(point => point.latitude));
  const minLongitude = Math.min(...normalized.map(point => point.longitude));
  const maxLongitude = Math.max(...normalized.map(point => point.longitude));
  const latitudeSpan = Math.abs(project(maxLatitude, 0, 0).y - project(minLatitude, 0, 0).y);
  const longitudeSpan = Math.abs(project(0, maxLongitude, 0).x - project(0, minLongitude, 0).x);
  const spanX = Math.max(longitudeSpan, 1);
  const spanY = Math.max(latitudeSpan, 1);
  const fitZoom = Math.floor(Math.log2(Math.min(Math.max(width - 112, 1) / spanX, Math.max(height - 112, 1) / spanY)));
  const baseZoom = normalized.length === 1 || (spanX < 2 && spanY < 2) ? 14 : fitZoom;
  const zoom = Math.max(3, Math.min(18, baseZoom + zoomAdjustment));
  const projected = normalized.map(point => ({ id: point.id, ...project(point.latitude, point.longitude, zoom) }));
  const centerX = (Math.min(...projected.map(point => point.x)) + Math.max(...projected.map(point => point.x))) / 2;
  const centerY = (Math.min(...projected.map(point => point.y)) + Math.max(...projected.map(point => point.y))) / 2;
  const leftWorld = centerX - width / 2;
  const topWorld = centerY - height / 2;
  const firstTileX = Math.floor(leftWorld / TILE_SIZE);
  const lastTileX = Math.floor((centerX + width / 2) / TILE_SIZE);
  const firstTileY = Math.floor(topWorld / TILE_SIZE);
  const lastTileY = Math.floor((centerY + height / 2) / TILE_SIZE);
  const tileCount = 2 ** zoom;
  const tiles: GpsMapTile[] = [];

  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        left: tileX * TILE_SIZE - leftWorld,
        top: tileY * TILE_SIZE - topWorld
      });
    }
  }

  return {
    zoom,
    tiles,
    markers: projected.map(point => ({ id: point.id, left: point.x - leftWorld, top: point.y - topWorld }))
  };
}
