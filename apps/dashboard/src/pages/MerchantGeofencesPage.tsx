import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type Venue = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type Geofence = {
  id: string;
  type: "circle" | "polygon";
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  polygon_coordinates: Array<[number, number]> | null;
  created_at: string;
};

type QrRecord = {
  id: string;
  type: "entry" | "exit";
  nonce: string;
  expires_at: string;
  is_demo: boolean;
};

const defaultPolygon = "12.9716,77.5946\n12.9719,77.5956\n12.9709,77.5952";

export const MerchantGeofencesPage = () => {
  const queryClient = useQueryClient();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [mode, setMode] = useState<"circle" | "polygon">("circle");
  const [circle, setCircle] = useState({ centerLat: "12.9716", centerLng: "77.5946", radiusMeters: "120" });
  const [polygonText, setPolygonText] = useState(defaultPolygon);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: venues = [] } = useQuery({
    queryKey: ["merchant-venues"],
    queryFn: () => apiFetch<Venue[]>("/merchants/me/venues")
  });

  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === selectedVenueId) ?? null,
    [selectedVenueId, venues]
  );

  const { data: geofences = [] } = useQuery({
    queryKey: ["merchant-geofences", selectedVenueId],
    queryFn: () => apiFetch<Geofence[]>(`/venues/${selectedVenueId}/geofences`),
    enabled: !!selectedVenueId
  });

  const { data: qrRecords = [] } = useQuery({
    queryKey: ["merchant-qrs", selectedVenueId],
    queryFn: () => apiFetch<QrRecord[]>(`/venues/${selectedVenueId}/qr`),
    enabled: !!selectedVenueId,
    refetchInterval: 30_000
  });

  const createGeofence = useMutation({
    mutationFn: () => {
      if (!selectedVenueId) {
        throw new Error("Select a venue first");
      }

      if (mode === "circle") {
        return apiFetch(`/venues/${selectedVenueId}/geofences`, {
          method: "POST",
          body: JSON.stringify({
            type: "circle",
            centerLat: Number(circle.centerLat),
            centerLng: Number(circle.centerLng),
            radiusMeters: Number(circle.radiusMeters)
          })
        });
      }

      const polygonCoordinates = polygonText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [lat, lng] = line.split(",").map((value) => Number(value.trim()));
          return [lat, lng] as [number, number];
        });

      return apiFetch(`/venues/${selectedVenueId}/geofences`, {
        method: "POST",
        body: JSON.stringify({
          type: "polygon",
          polygonCoordinates
        })
      });
    },
    onSuccess: () => {
      setFeedback("Geofence saved.");
      void queryClient.invalidateQueries({ queryKey: ["merchant-geofences", selectedVenueId] });
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    }
  });

  const deleteGeofence = useMutation({
    mutationFn: (geofenceId: string) =>
      apiFetch(`/geofences/${geofenceId}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      setFeedback("Geofence removed.");
      void queryClient.invalidateQueries({ queryKey: ["merchant-geofences", selectedVenueId] });
    },
    onError: (error: Error) => setFeedback(error.message)
  });

  const generateQr = useMutation({
    mutationFn: ({ type, demo }: { type: "entry" | "exit"; demo: boolean }) => {
      if (!selectedVenueId) {
        throw new Error("Select a venue first");
      }

      const url = `/venues/${selectedVenueId}/qr/generate?type=${type}&demo=${demo ? "true" : "false"}`;
      return apiFetch(url, { method: "POST" });
    },
    onSuccess: () => {
      setFeedback("QR token generated.");
      void queryClient.invalidateQueries({ queryKey: ["merchant-qrs", selectedVenueId] });
    },
    onError: (error: Error) => setFeedback(error.message)
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Venue access</p>
        <h2 className="mt-3 text-3xl font-semibold">Geofences and QR controls</h2>

        <div className="mt-5">
          <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-ink/55">Venue</label>
          <select
            value={selectedVenueId ?? ""}
            onChange={(event) => {
              setSelectedVenueId(event.target.value || null);
              setFeedback(null);
            }}
            className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
          >
            <option value="">Select venue...</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>

        {selectedVenue && (
          <div className="mt-5 space-y-4">
            <div className="rounded-[24px] bg-white/55 p-4 text-sm text-ink/70">
              <p className="font-semibold text-ink">{selectedVenue.name}</p>
              <p className="mt-1">
                Venue coordinates: {Number(selectedVenue.lat ?? 0).toFixed(5)}, {Number(selectedVenue.lng ?? 0).toFixed(5)}
              </p>
            </div>

            <div className="flex gap-2">
              {(["circle", "polygon"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    mode === value ? "bg-violet text-white" : "bg-white/55 text-ink"
                  }`}
                >
                  {value === "circle" ? "Circle geofence" : "Polygon geofence"}
                </button>
              ))}
            </div>

            {mode === "circle" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={circle.centerLat}
                  onChange={(event) => setCircle((current) => ({ ...current, centerLat: event.target.value }))}
                  placeholder="Center latitude"
                  className="rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
                />
                <input
                  value={circle.centerLng}
                  onChange={(event) => setCircle((current) => ({ ...current, centerLng: event.target.value }))}
                  placeholder="Center longitude"
                  className="rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
                />
                <input
                  value={circle.radiusMeters}
                  onChange={(event) => setCircle((current) => ({ ...current, radiusMeters: event.target.value }))}
                  placeholder="Radius meters"
                  className="rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
                />
              </div>
            ) : (
              <textarea
                value={polygonText}
                onChange={(event) => setPolygonText(event.target.value)}
                rows={6}
                className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
                placeholder="One lat,lng pair per line"
              />
            )}

            <button
              onClick={() => createGeofence.mutate()}
              disabled={createGeofence.isPending}
              className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {createGeofence.isPending ? "Saving..." : "Save geofence"}
            </button>

            <div className="rounded-[24px] bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-ink/55">QR actions</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={() => generateQr.mutate({ type: "entry", demo: false })}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  Generate entry QR
                </button>
                <button
                  onClick={() => generateQr.mutate({ type: "exit", demo: false })}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink"
                >
                  Generate exit QR
                </button>
                <button
                  onClick={() => generateQr.mutate({ type: "entry", demo: true })}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Generate demo QR
                </button>
                <a
                  href={selectedVenueId ? `${import.meta.env.VITE_API_URL}/venues/${selectedVenueId}/qr.png` : "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Download QR PNG
                </a>
              </div>
            </div>

            {feedback ? <p className="text-sm text-ink/65">{feedback}</p> : null}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="text-xl font-semibold">Configured geofences</h3>
          <div className="mt-4 space-y-3">
            {geofences.map((geofence) => (
              <article key={geofence.id} className="rounded-[22px] bg-white/55 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">{geofence.type === "circle" ? "Circle boundary" : "Polygon boundary"}</p>
                    <p className="mt-1 text-sm text-ink/65">
                      {geofence.type === "circle"
                        ? `${Number(geofence.center_lat ?? 0).toFixed(5)}, ${Number(geofence.center_lng ?? 0).toFixed(5)} • ${geofence.radius_meters ?? 0}m`
                        : `${geofence.polygon_coordinates?.length ?? 0} polygon points`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteGeofence.mutate(geofence.id)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {selectedVenueId && geofences.length === 0 ? (
              <p className="text-sm text-ink/55">No geofence configured for this venue yet.</p>
            ) : null}
          </div>
        </div>

        <div className="glass-panel rounded-[32px] p-6">
          <h3 className="text-xl font-semibold">Active QR tokens</h3>
          <div className="mt-4 space-y-3">
            {qrRecords.map((record) => (
              <article key={record.id} className="rounded-[22px] bg-white/55 p-4">
                <p className="font-semibold text-ink">
                  {record.type === "entry" ? "Entry QR" : "Exit QR"} {record.is_demo ? "• Demo" : ""}
                </p>
                <p className="mt-1 text-sm text-ink/65">Nonce: {record.nonce.slice(0, 16)}...</p>
                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-ink/50">
                  Expires {new Date(record.expires_at).toLocaleString()}
                </p>
              </article>
            ))}
            {selectedVenueId && qrRecords.length === 0 ? (
              <p className="text-sm text-ink/55">No active QR tokens for this venue.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};
