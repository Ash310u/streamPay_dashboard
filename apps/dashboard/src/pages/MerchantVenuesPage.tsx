import { useState } from "react";
import {
  useGetMerchantVenuesQuery,
  useCreateVenueMutation,
  useUpdateVenueMutation,
  useDeleteVenueMutation
} from "../store/api";

type Venue = {
  id: string;
  name: string;
  city: string;
  address: string;
  category: string;
  description?: string;
  lat?: number;
  lng?: number;
};

export const MerchantVenuesPage = () => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "coworking",
    address: "",
    city: "",
    lat: 12.9716,
    lng: 77.5946
  });
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "",
    address: "",
    city: "",
    lat: 0,
    lng: 0
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: venuesData = [], isLoading: venuesLoading, isError: venuesError, refetch: venuesRefetch } = useGetMerchantVenuesQuery();

  const [createVenueMutation, { isLoading: isCreatePending, isError: isCreateError, error: createError }] = useCreateVenueMutation();
  const [updateVenueMutation, { isLoading: isUpdatePending, isError: isUpdateError, error: updateError }] = useUpdateVenueMutation();
  const [deleteVenueMutation, { isLoading: isDeletePending }] = useDeleteVenueMutation();

  const handleCreateVenue = async () => {
    try {
      await createVenueMutation(form).unwrap();
      setForm({
        name: "",
        description: "",
        category: "coworking",
        address: "",
        city: "",
        lat: 12.9716,
        lng: 77.5946
      });
    } catch {}
  };

  const handleUpdateVenue = async () => {
    if (!editingVenue) return;
    try {
      await updateVenueMutation({ id: editingVenue.id, body: editForm }).unwrap();
      setEditingVenue(null);
    } catch {}
  };

  const handleDeleteVenue = async (id: string) => {
    try {
      await deleteVenueMutation(id).unwrap();
      setDeleteConfirmId(null);
    } catch {}
  };

  const startEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setEditForm({
      name: venue.name,
      description: venue.description ?? "",
      category: venue.category,
      address: venue.address,
      city: venue.city,
      lat: venue.lat ?? 12.9716,
      lng: venue.lng ?? 77.5946
    });
  };

  const inputClass = "w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 outline-none";

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Venue setup</p>
        <h2 className="mt-3 text-3xl font-semibold">Create and manage venues.</h2>

        {editingVenue ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold text-violet">Editing: {editingVenue.name}</p>
            {["name", "description", "address", "city"].map((field) => (
              <input
                key={field}
                value={editForm[field as keyof typeof editForm] as string}
                onChange={(event) => setEditForm((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={field}
                className={inputClass}
              />
            ))}
            <select
              value={editForm.category}
              onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
              className={inputClass}
            >
              {["gym", "ev_charger", "coworking", "parking", "lab", "other"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => void handleUpdateVenue()}
                disabled={isUpdatePending}
                className="rounded-full bg-violet px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {isUpdatePending ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => setEditingVenue(null)}
                className="rounded-full bg-white/55 px-5 py-3 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            </div>
            {isUpdateError && (
              <p className="text-sm text-rose-600">{(updateError as any)?.data?.error || (updateError as any)?.message}</p>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {["name", "description", "address", "city"].map((field) => (
              <input
                key={field}
                value={form[field as keyof typeof form] as string}
                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={field}
                className={inputClass}
              />
            ))}
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className={inputClass}
            >
              {["gym", "ev_charger", "coworking", "parking", "lab", "other"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              onClick={() => void handleCreateVenue()}
              disabled={isCreatePending}
              className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isCreatePending ? "Creating…" : "Create venue"}
            </button>
            {isCreateError && (
              <p className="text-sm text-rose-600">{(createError as any)?.data?.error || (createError as any)?.message}</p>
            )}
          </div>
        )}
      </section>

      <section className="glass-panel rounded-[32px] p-6">
        <h3 className="text-xl font-semibold">Existing venues</h3>
        {venuesLoading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
          </div>
        ) : venuesError ? (
          <div className="mt-4 rounded-[22px] bg-rose-50/80 p-4 text-sm text-rose-600">
            Failed to load venues.
            <button onClick={() => void venuesRefetch()} className="ml-2 underline">Retry</button>
          </div>
        ) : venuesData.length === 0 ? (
          <p className="mt-4 text-sm text-ink/55">No venues yet. Create one to get started.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {venuesData.map((venue: any) => (
              <article key={venue.id} className="rounded-[22px] bg-white/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{venue.name}</p>
                    <p className="mt-1 text-sm text-ink/65">{venue.address}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.25em] text-ink/50">{venue.city} · {venue.category}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(venue)}
                      className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:-translate-y-0.5"
                    >
                      Edit
                    </button>
                    {deleteConfirmId === venue.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => void handleDeleteVenue(venue.id)}
                          disabled={isDeletePending}
                          className="rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {isDeletePending ? "…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(venue.id)}
                        className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
