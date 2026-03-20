import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type Geofence = {
  id?: string;
  type: "circle" | "polygon";
  center_lat?: number;
  center_lng?: number;
  radius_meters?: number;
  polygon_coordinates?: Array<[number, number]>;
};

interface Props {
  venueId: string;
  lat: number;
  lng: number;
  onSaved?: () => void;
}

export const GeofenceMapEditor = ({ venueId, lat, lng, onSaved }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"circle" | "polygon">("circle");
  const [circleLat, setCircleLat] = useState(lat);
  const [circleLng, setCircleLng] = useState(lng);
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [polygonCoords, setPolygonCoords] = useState<Array<[number, number]>>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapInstance = useRef<unknown>(null);
  const shapeLayer = useRef<unknown>(null);

  const geofenceQuery = useQuery({
    queryKey: ["geofence", venueId],
    queryFn: () => apiFetch<Geofence[]>(`/venues/${venueId}/geofences`)
  });

  // Dynamically load Leaflet from CDN
  useEffect(() => {
    if ((window as unknown as { L?: unknown }).L) {
      setLeafletLoaded(true);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Hydrate from existing geofence
  useEffect(() => {
    const existing = geofenceQuery.data?.[0];
    if (!existing) return;
    setMode(existing.type);
    if (existing.type === "circle") {
      if (existing.center_lat) setCircleLat(existing.center_lat);
      if (existing.center_lng) setCircleLng(existing.center_lng);
      if (existing.radius_meters) setRadiusMeters(existing.radius_meters);
    } else if (existing.polygon_coordinates) {
      setPolygonCoords(existing.polygon_coordinates);
    }
  }, [geofenceQuery.data]);

  // Initialise map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;
    const L = (window as unknown as { L: typeof import("leaflet") }).L;
    if (mapInstance.current) return; // already initialised

    const map = L.map(mapRef.current).setView([lat, lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    mapInstance.current = map;

    map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
      setMode((prev) => {
        if (prev === "circle") {
          setCircleLat(e.latlng.lat);
          setCircleLng(e.latlng.lng);
        } else {
          setPolygonCoords((coords) => [...coords, [e.latlng.lat, e.latlng.lng]]);
        }
        return prev;
      });
    });
  }, [leafletLoaded, lat, lng]);

  // Re-draw shape when state changes
  useEffect(() => {
    if (!leafletLoaded || !mapInstance.current) return;
    const L = (window as unknown as { L: typeof import("leaflet") }).L;
    const map = mapInstance.current as ReturnType<typeof L.map>;

    if (shapeLayer.current) {
      map.removeLayer(shapeLayer.current as ReturnType<typeof L.circle>);
    }

    if (mode === "circle") {
      const circle = L.circle([circleLat, circleLng], { radius: radiusMeters, color: "#7c3aed" }).addTo(map);
      shapeLayer.current = circle;
    } else if (polygonCoords.length >= 3) {
      const poly = L.polygon(polygonCoords as [number, number][], { color: "#ff5ea8" }).addTo(map);
      shapeLayer.current = poly;
    }
  }, [leafletLoaded, mode, circleLat, circleLng, radiusMeters, polygonCoords]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const body =
        mode === "circle"
          ? { type: "circle", centerLat: circleLat, centerLng: circleLng, radiusMeters }
          : { type: "polygon", polygonCoordinates: polygonCoords };

      await apiFetch(`/venues/${venueId}/geofences`, {
        method: "POST",
        body: JSON.stringify(body)
      });

      setStatus("Geofence saved!");
      onSaved?.();
    } catch (err) {
      setStatus(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        {(["circle", "polygon"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setPolygonCoords([]); }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === m ? "bg-violet text-white" : "bg-white/55 text-ink"
            }`}
          >
            {m === "circle" ? "⭕ Circle" : "✏️ Polygon"}
          </button>
        ))}
        {mode === "polygon" && polygonCoords.length > 0 && (
          <button
            onClick={() => setPolygonCoords([])}
            className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Map */}
      <div ref={mapRef} className="h-64 w-full rounded-2xl border border-white/40 overflow-hidden" />

      {!leafletLoaded && (
        <p className="text-sm text-ink/55">Loading map…</p>
      )}

      {/* Radius slider for circle mode */}
      {mode === "circle" && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-ink/65 min-w-[80px]">Radius</label>
          <input
            type="range"
            min={10}
            max={2000}
            step={10}
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-medium min-w-[60px]">{radiusMeters} m</span>
        </div>
      )}

      {/* Polygon point count */}
      {mode === "polygon" && (
        <p className="text-sm text-ink/55">
          {polygonCoords.length} point{polygonCoords.length !== 1 ? "s" : ""} • Click on map to add points (min 3)
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || (mode === "polygon" && polygonCoords.length < 3)}
        className="self-start rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save geofence"}
      </button>

      {status && (
        <p className={`text-sm ${status.startsWith("Geofence") ? "text-green-600" : "text-red-500"}`}>
          {status}
        </p>
      )}
    </div>
  );
};
