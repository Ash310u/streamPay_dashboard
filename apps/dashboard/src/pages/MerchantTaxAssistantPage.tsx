import { useAppDispatch, useAppSelector } from "../store";
import {
  useGetMerchantTaxSummaryQuery,
  useAskTaxAssistantMutation,
  useGenerateTaxPdfMutation
} from "../store/api";
import { selectMerchantTaxAssistant, setMerchantTaxFinancialYear, setMerchantTaxQuestion } from "../store/slices/merchantTaxAssistantSlice";

export const MerchantTaxAssistantPage = () => {
  const dispatch = useAppDispatch();
  const { question, financialYear } = useAppSelector(selectMerchantTaxAssistant);

  const { data: summaryData, isLoading: summaryLoading, isError: summaryError, refetch: summaryRefetch } = useGetMerchantTaxSummaryQuery(financialYear);
  const [askChat, { isLoading: isChatPending, data: chatData, isError: isChatError, error: chatError }] = useAskTaxAssistantMutation();
  const [generatePdf, { isLoading: isPdfPending, data: pdfData, isError: isPdfError, error: pdfError }] = useGenerateTaxPdfMutation();

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <section className="glass-panel rounded-[32px] p-6">
        <p className="text-sm uppercase tracking-[0.35em] text-ink/55">Tax assistant</p>
        <h2 className="mt-3 text-3xl font-semibold">Ask tax questions grounded in your platform data.</h2>

        <div className="mt-5">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-ink/55">Financial year</label>
          <select
            value={financialYear}
            onChange={(e) => dispatch(setMerchantTaxFinancialYear(e.target.value))}
            className="w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-sm outline-none"
          >
            {["2024-2025", "2025-2026", "2026-2027"].map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
        </div>

        <textarea
          value={question}
          onChange={(event) => dispatch(setMerchantTaxQuestion(event.target.value))}
          className="mt-4 min-h-40 w-full rounded-[24px] border border-white/40 bg-white/55 p-4 outline-none"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => void askChat({ question, financialYear })}
            disabled={isChatPending}
            className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isChatPending ? "Thinking…" : "Ask assistant"}
          </button>
          <button
            onClick={() => void generatePdf(financialYear)}
            disabled={isPdfPending}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPdfPending ? "Generating…" : "Generate PDF"}
          </button>
        </div>

        {isChatError && (
          <p className="mt-4 text-sm text-rose-600">{(chatError as any)?.data?.error || (chatError as any)?.message}</p>
        )}
        {chatData ? (
          <p className="mt-5 rounded-[22px] bg-white/55 p-4 text-sm text-ink/80">{chatData.answer}</p>
        ) : null}

        {isPdfError && (
          <p className="mt-4 text-sm text-rose-600">{(pdfError as any)?.data?.error || (pdfError as any)?.message}</p>
        )}
        {pdfData ? (
          <div className="mt-4">
            <a
              className="inline-block text-sm font-semibold text-blush"
              href={pdfData.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              📄 Open {pdfData.fileName ?? "generated PDF"}
            </a>
          </div>
        ) : null}
      </section>

      <section className="glass-panel rounded-[32px] p-6">
        <h3 className="text-xl font-semibold">Current summary ({financialYear})</h3>
        {summaryLoading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet border-t-transparent" />
          </div>
        ) : summaryError ? (
          <div className="mt-4 rounded-[22px] bg-rose-50/80 p-4 text-sm text-rose-600">
            Failed to load tax summary.
            <button onClick={() => void summaryRefetch()} className="ml-2 underline">Retry</button>
          </div>
        ) : (
          <pre className="mt-4 overflow-auto rounded-[22px] bg-white/55 p-4 text-xs text-ink/75">
            {JSON.stringify(summaryData, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
};
