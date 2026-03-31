import { useMemo, useState } from "react";
import {
  useGetMerchantVenuesQuery,
  useGetVenueGeofencesQuery,
  useGetVenueQrCodesQuery,
  useCreateGeofenceMutation,
  useDeleteGeofenceMutation,
  useUpdateGeofenceMutation,
  useGenerateVenueQrMutation
} from "../store/api";

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
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [mode, setMode] = useState<"circle" | "polygon">("circle");
  const [circle, setCircle] = useState({ centerLat: "12.9716", centerLng: "77.5946", radiusMeters: "120" });
  const [polygonText, setPolygonText] = useState(defaultPolygon);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [editCircle, setEditCircle] = useState({ centerLat: "", centerLng: "", radiusMeters: "" });
  const [editPolygonText, setEditPolygonText] = useState("");

  const { data: venues = [] } = useGetMerchantVenuesQuery();

  const selectedVenue = useMemo(
    () => venues.find((venue: any) => venue.id === selectedVenueId) ?? null,
    [selectedVenueId, venues]
  );

  const { data: geofences = [], isLoading: geofencesLoading } = useGetVenueGeofencesQuery(selectedVenueId ?? "", {
    skip: !selectedVenueId
  });

  const { data: qrRecords = [] } = useGetVenueQrCodesQuery(selectedVenueId ?? "", {
    skip: !selectedVenueId,
    pollingInterval: 30000
  });

  const [createGeofence, { isLoading: isCreatePending }] = useCreateGeofenceMutation();
  const [deleteGeofence, { isLoading: isDeletePending }] = useDeleteGeofenceMutation();
  const [updateGeofence, { isLoading: isUpdatePending }] = useUpdateGeofenceMutation();
  const [generateQr, { isLoading: isQrPending }] = useGenerateVenueQrMutation();

  const handleCreateGeofence = async () => {
    try {
      if (!selectedVenueId) throw new Error("Select a venue first");

      if (mode === "circle") {
        await createGeofence({
          venueId: selectedVenueId,
          body: {
            type: "circle",
            centerLat: Number(circle.centerLat),
            centerLng: Number(circle.centerLng),
            radiusMeters: Number(circle.radiusMeters)
          }
        }).unwrap();
      } else {
        const polygonCoordinates = polygonText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [lat, lng] = line.split(",").map((value) => Number(value.trim()));
            return [lat, lng] as [number, number];
          });
        await createGeofence({
          venueId: selectedVenueId,
          body: { type: "polygon", polygonCoordinates }
        }).unwrap();
      }
      setFeedback("Geofence saved.");
    } catch (e: any) {
      setFeedback(e?.data?.error || e?.message || "Failed");
    }
  };

  const handleDeleteGeofence = async (id: string) => {
    try {
      await deleteGeofence(id).unwrap();
      setFeedback("Geofence removed.");
    } catch (e: any) {
      setFeedback(e?.data?.error || e?.message || "Failed");
    }
  };

  const handleUpdateGeofence = async () => {
    try {
      if (!editingGeofence) throw new Error("No geofence selected");
      if (editingGeofence.type === "circle") {
        await updateGeofence({
          id: editingGeofence.id,
          body: {
            type: "circle",
            centerLat: Number(editCircle.centerLat),
            centerLng: Number(editCircle.centerLng),
            radiusMeters: Number(editCircle.radiusMeters)
          }
        }).unwrap();
      } else {
        const polygonCoordinates = editPolygonText
          .split("\\n").map((l) => l.trim()).filter(Boolean)
          .map((l) => { const [lat, lng] = l.split(",").map(Number); return [lat, lng]; });
        await updateGeofence({
          id: editingGeofence.id,
          body: { type: "polygon", polygonCoordinates }
        }).unwrap();
      }
      setFeedback("Geofence updated.");
      setEditingGeofence(null);
    } catch (e: any) {
      setFeedback(e?.data?.error || e?.message || "Failed");
    }
  };

  const handleGenerateQr = async (type: "entry" | "exit", demo: boolean) => {
    try {
      if (!selectedVenueId) throw new Error("Select a venue first");
      await generateQr({ venueId: selectedVenueId, type: type + (demo ? "&demo=true" : "") }).unwrap();
      setFeedback("QR token generated.");
    } catch (e: any) {
      setFeedback(e?.data?.error || e?.message || "Failed");
    }
  };

  const startEditGeofence = (gf: Geofence) => {
    setEditingGeofence(gf);
    if (gf.type === "circle") {
      setEditCircle({
        centerLat: String(gf.center_lat ?? 0),
        centerLng: String(gf.center_lng ?? 0),
        radiusMeters: String(gf.radius_meters ?? 100)
      });
    } else {
      setEditPolygonText(
        (gf.polygon_coordinates ?? []).map(([lat, lng]) => `${lat},${lng}`).join("\\n")
      );
    }
  };

  const inputClass = "rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none";

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
              setEditingGeofence(null);
            }}
            className={`w-full ${inputClass}`}
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
                  className={inputClass}
                />
                <input
                  value={circle.centerLng}
                  onChange={(event) => setCircle((current) => ({ ...current, centerLng: event.target.value }))}
                  placeholder="Center longitude"
                  className={inputClass}
                />
                <input
                  value={circle.radiusMeters}
                  onChange={(event) => setCircle((current) => ({ ...current, radiusMeters: event.target.value }))}
                  placeholder="Radius meters"
                  className={inputClass}
                />
              </div>
            ) : (
              <textarea
                value={polygonText}
                onChange={(event) => setPolygonText(event.target.value)}
                rows={6}
                className={`w-full ${inputClass}`}
                placeholder="One lat,lng pair per line"
              />
            )}

            <button
              onClick={() => void handleCreateGeofence()}
              disabled={isCreatePending}
              className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isCreatePending ? "Saving..." : "Save geofence"}
            </button>

            <div className="rounded-[24px] bg-white/55 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-ink/55">QR actions</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={() => void handleGenerateQr("entry", false)}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  Generate entry QR
                </button>
                <button
                  onClick={() => void handleGenerateQr("exit", false)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink"
                >
                  Generate exit QR
                </button>
                <button
                  onClick={() => void handleGenerateQr("entry", true)}
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
          {geofencesLoading ? (
            <div className="mt-4 flex items-center justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {geofences.map((geofence) => (
                <article key={geofence.id} className="rounded-[22px] bg-white/55 p-4">
                  {editingGeofence?.id === geofence.id ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-violet">Editing {geofence.type} geofence</p>
                      {geofence.type === "circle" ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <input value={editCircle.centerLat} onChange={(e) => setEditCircle((c) => ({ ...c, centerLat: e.target.value }))} placeholder="Lat" className={inputClass} />
                          <input value={editCircle.centerLng} onChange={(e) => setEditCircle((c) => ({ ...c, centerLng: e.target.value }))} placeholder="Lng" className={inputClass} />
                          <input value={editCircle.radiusMeters} onChange={(e) => setEditCircle((c) => ({ ...c, radiusMeters: e.target.value }))} placeholder="Radius" className={inputClass} />
                        </div>
                      ) : (
                        <textarea value={editPolygonText} onChange={(e) => setEditPolygonText(e.target.value)} rows={4} className={`w-full ${inputClass}`} />
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => void handleUpdateGeofence()} disabled={isUpdatePending} className="rounded-full bg-violet px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                          {isUpdatePending ? "Saving…" : "Update"}
                        </button>
                        <button onClick={() => setEditingGeofence(null)} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-ink">{geofence.type === "circle" ? "Circle boundary" : "Polygon boundary"}</p>
                        <p className="mt-1 text-sm text-ink/65">
                          {geofence.type === "circle"
                            ? `${Number(geofence.center_lat ?? 0).toFixed(5)}, ${Number(geofence.center_lng ?? 0).toFixed(5)} • ${geofence.radius_meters ?? 0}m`
                            : `${geofence.polygon_coordinates?.length ?? 0} polygon points`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditGeofence(geofence)}
                          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleDeleteGeofence(geofence.id)}
                          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {selectedVenueId && geofences.length === 0 ? (
                <p className="text-sm text-ink/55">No geofence configured for this venue yet.</p>
              ) : null}
            </div>
          )}
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
