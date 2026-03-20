import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../lib/api";

type Venue = {
  id: string;
  name: string;
  city: string;
  address: string;
  category: string;
};

export const MerchantVenuesPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "coworking",
    address: "",
    city: "",
    lat: 12.9716,
    lng: 77.5946
  });

  const venuesQuery = useQuery({
    queryKey: ["merchant-venues"],
    queryFn: () => apiFetch<Venue[]>("/merchants/me/venues")
  });

  const createVenue = useMutation({
    mutationFn: () =>
      apiFetch("/venues", {
        method: "POST",
        body: JSON.stringify(form)
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["merchant-venues"] });
      setForm({
        name: "",
        description: "",
        category: "coworking",
        address: "",
        city: "",
        lat: 12.9716,
        lng: 77.5946
      });
    }
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Venue setup</p>
        <h2 className="mt-3 text-3xl font-semibold">Create and manage venues.</h2>
        <div className="mt-6 space-y-3">
          {["name", "description", "address", "city"].map((field) => (
            <input
              key={field}
              value={form[field as keyof typeof form] as string}
              onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
              placeholder={field}
              className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 outline-none"
            />
          ))}
          <select
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 outline-none"
          >
            {["gym", "ev_charger", "coworking", "parking", "lab", "other"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            onClick={() => createVenue.mutate()}
            className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            Create venue
          </button>
        </div>
      </section>

      <section className="glass-panel rounded-[32px] p-6">
        <h3 className="text-xl font-semibold">Existing venues</h3>
        <div className="mt-4 space-y-3">
          {(venuesQuery.data ?? []).map((venue) => (
            <article key={venue.id} className="rounded-[22px] bg-white/55 p-4">
              <p className="font-medium">{venue.name}</p>
              <p className="mt-1 text-sm text-ink/65">{venue.address}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.25em] text-ink/50">{venue.city}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

