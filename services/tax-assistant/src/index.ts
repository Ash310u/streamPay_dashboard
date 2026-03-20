import { createServiceSupabaseClient } from "@detrix/supabase-client";

const SYSTEM_PROMPT =
  "You are an Indian tax filing assistant for small business owners using a pay-per-use platform. The merchant earns INR revenue settled via T+1 bank transfer. Internally, transactions run through crypto. You help with GST, TDS (194-O), ITR-3/ITR-4 filing, and income classification. Always remind users to consult a CA for legal advice.";

export class TaxAssistantService {
  private readonly supabase = createServiceSupabaseClient();

  async buildContext(merchantId: string, financialYear: string) {
    const [taxRecord, settlementHistory] = await Promise.all([
      this.supabase.from("tax_records").select("*").eq("merchant_id", merchantId).eq("financial_year", financialYear).maybeSingle(),
      this.supabase.from("settlement_batches").select("*").eq("merchant_id", merchantId).order("batch_date", { ascending: false }).limit(20)
    ]);

    return {
      systemPrompt: SYSTEM_PROMPT,
      taxRecord: taxRecord.data,
      settlementHistory: settlementHistory.data ?? []
    };
  }
}

