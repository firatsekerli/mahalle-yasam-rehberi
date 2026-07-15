"use client";

/**
 * Map point picker (CLAUDE.md §19.2 "Haritadan seç", §19.4).
 *
 * Click the map to drop a pin, then generate an arbitrary-point report for that
 * coordinate. MapLibre is loaded dynamically; degrades to a message when no tile
 * style is configured.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { T } from "@/lib/i18n/tr";

interface Props {
  styleUrl?: string;
  initialCenter: { lat: number; lng: number };
}

export default function MapPicker({ styleUrl, initialCenter }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!ref.current || !styleUrl) return;
    let map: MapLibreMap | undefined;
    let marker: MapLibreMarker | undefined;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !ref.current) return;

      map = new maplibregl.Map({
        container: ref.current,
        style: styleUrl,
        center: [initialCenter.lng, initialCenter.lat],
        zoom: 13,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        setPicked({ lat, lng });
        if (marker) marker.setLngLat([lng, lat]);
        else marker = new maplibregl.Marker({ color: "#1d4ed8" }).setLngLat([lng, lat]).addTo(map!);
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [styleUrl, initialCenter]);

  if (!styleUrl) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-surface-2 px-6 text-center text-sm text-muted">
        {T.picker.mapPickFallback}
      </div>
    );
  }

  return (
    <div>
      <div
        ref={ref}
        className="h-[32rem] w-full overflow-hidden rounded-[var(--radius-card)] border border-line"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {picked
            ? `${T.picker.mapPickChosen}: ${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`
            : T.picker.mapPickPrompt}
        </p>
        <button
          type="button"
          disabled={!picked}
          onClick={() => picked && router.push(`/nokta?lat=${picked.lat}&lng=${picked.lng}`)}
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {T.picker.mapPickButton}
        </button>
      </div>
    </div>
  );
}
