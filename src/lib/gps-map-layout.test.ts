import { describe, expect, it } from "vitest";
import { createGpsMapLayout } from "./gps-map-layout";

describe("createGpsMapLayout", () => {
  it("returns no tiles or markers when there are no locations", () => {
    expect(createGpsMapLayout([], 900, 360)).toEqual({ zoom: 0, tiles: [], markers: [] });
  });

  it("centers a single marker and generates attributed OpenStreetMap tile URLs", () => {
    const layout = createGpsMapLayout([{ id: "person-1", latitude: -6.2, longitude: 106.8 }], 900, 360);
    expect(layout.zoom).toBe(14);
    expect(layout.markers).toHaveLength(1);
    expect(layout.markers[0].left).toBeCloseTo(450, 0);
    expect(layout.markers[0].top).toBeCloseTo(180, 0);
    expect(layout.tiles.length).toBeGreaterThan(0);
    expect(layout.tiles.every(tile => tile.url.startsWith("https://tile.openstreetmap.org/14/"))).toBe(true);
  });

  it("fits multiple distant locations within the viewport", () => {
    const layout = createGpsMapLayout([
      { id: "a", latitude: -6.2, longitude: 106.8 },
      { id: "b", latitude: -7.8, longitude: 110.4 }
    ], 900, 360);
    expect(layout.zoom).toBeGreaterThanOrEqual(3);
    expect(layout.zoom).toBeLessThan(14);
    for (const marker of layout.markers) {
      expect(marker.left).toBeGreaterThanOrEqual(0);
      expect(marker.left).toBeLessThanOrEqual(900);
      expect(marker.top).toBeGreaterThanOrEqual(0);
      expect(marker.top).toBeLessThanOrEqual(360);
    }
  });

  it("clamps invalid latitude and longitude to valid map bounds", () => {
    const layout = createGpsMapLayout([{ id: "edge", latitude: 91, longitude: 200 }], 900, 360);
    expect(layout.markers[0].left).toBeCloseTo(450, 0);
    expect(layout.markers[0].top).toBeCloseTo(180, 0);
  });
});
