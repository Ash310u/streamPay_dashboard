import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type Venue = {
  id: string;
  name: string;
  city: string;
  address: string;
  category: string;
};

export const CustomerVenuesPage = () => {
  const venuesQuery = useQuery({
    queryKey: ["public-venues"],
    queryFn: () => apiFetch<Venue[]>("/venues")
  });

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Venue discovery</p>
        <h2 className="mt-3 text-3xl font-semibold">Nearby spaces and pay-per-use services.</h2>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {(venuesQuery.data ?? []).map((venue) => (
          <article key={venue.id} className="glass-panel rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-ink/50">{venue.category}</p>
            <h3 className="mt-2 text-2xl font-semibold">{venue.name}</h3>
            <p className="mt-2 text-sm text-ink/65">{venue.address}</p>
            <p className="mt-1 text-sm text-ink/55">{venue.city}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

