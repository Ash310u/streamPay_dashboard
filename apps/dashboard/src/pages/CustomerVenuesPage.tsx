import { useState } from "react";
import { useGetVenuesQuery, useGetVenueQuery } from "../store/api";

type Venue = {
  id: string;
  name: string;
  city: string;
  address: string;
  category: string;
  description?: string;
  lat?: number;
  lng?: number;
  is_active?: boolean;
};

export const CustomerVenuesPage = () => {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string | undefined>(undefined);

  const { data: venuesData, isLoading: venuesLoading, isError: venuesError, refetch: venuesRefetch } = useGetVenuesQuery(cityFilter || undefined);
  const { data: venueDetailData } = useGetVenueQuery(selectedVenueId ?? "", { skip: !selectedVenueId });

  const cities = [...new Set((venuesData ?? []).map((v: Venue) => v.city).filter(Boolean))];

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Venue discovery</p>
        <h2 className="mt-3 text-3xl font-semibold">Nearby spaces and pay-per-use services.</h2>

        {cities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setCityFilter("")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                !cityFilter ? "bg-violet text-white" : "bg-white/55 text-ink"
              }`}
            >
              All cities
            </button>
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => setCityFilter(city)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  cityFilter === city ? "bg-violet text-white" : "bg-white/55 text-ink"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}
      </section>

      {venuesLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
        </div>
      ) : venuesError ? (
        <div className="rounded-[24px] bg-rose-50/80 p-4 text-sm text-rose-600">
          <p>Failed to load venues</p>
          <button onClick={() => void venuesRefetch()} className="mt-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700">
            Retry
          </button>
        </div>
      ) : (venuesData ?? []).length === 0 ? (
        <p className="rounded-[24px] bg-white/55 p-5 text-sm text-ink/55">No venues available{cityFilter ? ` in ${cityFilter}` : ""}.</p>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {(venuesData ?? []).map((venue: Venue) => (
            <article
              key={venue.id}
              className="glass-panel cursor-pointer rounded-[28px] p-6 transition hover:-translate-y-1"
              onClick={() => setSelectedVenueId(venue.id === selectedVenueId ? null : venue.id)}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-ink/50">{venue.category}</p>
              <h3 className="mt-2 text-2xl font-semibold">{venue.name}</h3>
              <p className="mt-2 text-sm text-ink/65">{venue.address}</p>
              <p className="mt-1 text-sm text-ink/55">{venue.city}</p>

              {selectedVenueId === venue.id && venueDetailData && (
                <div className="mt-4 rounded-[20px] bg-white/60 p-4 text-sm text-ink/70">
                  <p className="text-xs uppercase tracking-[0.25em] text-ink/50">Venue details</p>
                  {(venueDetailData as Venue).description && (
                    <p className="mt-2">{(venueDetailData as Venue).description}</p>
                  )}
                  {(venueDetailData as Venue).lat && (
                    <p className="mt-1 text-xs text-ink/45">
                      Location: {Number((venueDetailData as Venue).lat ?? 0).toFixed(5)}, {Number((venueDetailData as Venue).lng ?? 0).toFixed(5)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink/45">
                    Status: {(venueDetailData as Venue).is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
};
