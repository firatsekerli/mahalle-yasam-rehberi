"use client";

/**
 * Interactive neighborhood map (CLAUDE.md §15.3, §19.3).
 *
 * MapLibre GL over a vector-tile provider (MapTiler / self-hosted PMTiles).
 * Shows the measurement center, business markers, and — when available — the
 * walk isochrone shapes. MapLibre is loaded dynamically (client-only), and the
 * whole thing degrades to a labeled placeholder when no tile style is configured,
 * so the report never renders a broken map.
 */

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
}
export interface MapIsochrone {
  minutes: number;
  /** Outer ring as GeoJSON `[lng, lat]` pairs. */
  ring: number[][];
}

interface Props {
  center: { lat: number; lng: number };
  centerLabel: string;
  markers: MapMarker[];
  isochrones?: MapIsochrone[];
  /** Vector-tile style URL (e.g. MapTiler). When absent, a placeholder is shown. */
  styleUrl?: string;
  fallbackText: string;
}

export default function NeighborhoodMap({
  center,
  centerLabel,
  markers,
  isochrones,
  styleUrl,
  fallbackText,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !styleUrl) return;
    let map: MapLibreMap | undefined;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !ref.current) return;

      map = new maplibregl.Map({
        container: ref.current,
        style: styleUrl,
        center: [center.lng, center.lat],
        zoom: 14,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (!map) return;

        // Walk isochrones — larger band drawn under the smaller for nested shading.
        const bands = [...(isochrones ?? [])].sort((a, b) => b.minutes - a.minutes);
        for (const iso of bands) {
          const id = `iso-${iso.minutes}`;
          map.addSource(id, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [iso.ring] },
            } as Feature,
          });
          map.addLayer({
            id,
            type: "fill",
            source: id,
            paint: { "fill-color": "#16a34a", "fill-opacity": iso.minutes <= 10 ? 0.18 : 0.1 },
          });
        }

        // Business markers as a circle layer (performant for many points).
        map.addSource("places", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: markers.map((m) => ({
              type: "Feature",
              properties: { label: m.label },
              geometry: { type: "Point", coordinates: [m.lng, m.lat] },
            })),
          } as FeatureCollection,
        });
        map.addLayer({
          id: "places",
          type: "circle",
          source: "places",
          paint: {
            "circle-radius": 5,
            "circle-color": "#16a34a",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("click", "places", (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const coords = (f.geometry as Point).coordinates as [number, number];
          new maplibregl.Popup({ offset: 10 })
            .setLngLat(coords)
            .setText(String(f.properties?.label ?? ""))
            .addTo(map);
        });
        map.on("mouseenter", "places", () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "places", () => {
          if (map) map.getCanvas().style.cursor = "";
        });
      });

      // Measurement center pin (distinct color).
      new maplibregl.Marker({ color: "#1d4ed8" })
        .setLngLat([center.lng, center.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setText(centerLabel))
        .addTo(map);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [center, centerLabel, markers, isochrones, styleUrl]);

  if (!styleUrl) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-surface-2 px-6 text-center text-sm text-muted">
        {fallbackText}
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="h-80 w-full overflow-hidden rounded-[var(--radius-card)] border border-line"
    />
  );
}
