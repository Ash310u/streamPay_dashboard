import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../lib/api";

export const MerchantTaxAssistantPage = () => {
  const [question, setQuestion] = useState("What is my GST liability this quarter?");
  const summaryQuery = useQuery({
    queryKey: ["tax-summary"],
    queryFn: () => apiFetch("/tax/summary")
  });
  const chatMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ answer: string }>("/tax/chat", {
        method: "POST",
        body: JSON.stringify({ question })
      })
  });
  const pdfMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ publicUrl: string }>("/tax/summary/generate-pdf", {
        method: "POST",
        body: JSON.stringify({})
      })
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Tax assistant</p>
        <h2 className="mt-3 text-3xl font-semibold">Ask tax questions grounded in your platform data.</h2>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="mt-6 min-h-40 w-full rounded-[24px] border border-white/40 bg-white/55 p-4 outline-none"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => chatMutation.mutate()} className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white">
            Ask assistant
          </button>
          <button onClick={() => pdfMutation.mutate()} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
            Generate PDF
          </button>
        </div>
        {chatMutation.data ? <p className="mt-5 rounded-[22px] bg-white/55 p-4 text-sm text-ink/80">{chatMutation.data.answer}</p> : null}
        {pdfMutation.data ? <a className="mt-4 inline-block text-sm font-semibold text-blush" href={pdfMutation.data.publicUrl} target="_blank">Open generated PDF</a> : null}
      </section>

      <section className="glass-panel rounded-[32px] p-6">
        <h3 className="text-xl font-semibold">Current summary</h3>
        <pre className="mt-4 overflow-auto rounded-[22px] bg-white/55 p-4 text-xs text-ink/75">{JSON.stringify(summaryQuery.data, null, 2)}</pre>
      </section>
    </div>
  );
};

