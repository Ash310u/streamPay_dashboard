import type { FastifyInstance } from "fastify";
import { TaxAssistantService } from "@detrix/tax-assistant";
import { ApiError } from "../lib/api-error.js";

const SYSTEM_PROMPT =
  "You are an Indian tax filing assistant for small business owners using a pay-per-use platform. The merchant earns INR revenue settled via T+1 bank transfer. Internally, transactions run through crypto. You help with GST, TDS (194-O), ITR-3/ITR-4 filing, and income classification. Always remind users to consult a CA for legal advice.";

const buildSimplePdf = (title: string, lines: string[]) => {
  const safeLines = [title, ...lines].map((line) => line.replace(/[()]/g, ""));
  const content = ["BT", "/F1 16 Tf", "50 780 Td"];
  safeLines.forEach((line, index) => {
    content.push(index === 0 ? `(${line}) Tj` : `0 -22 Td (${line}) Tj`);
  });
  content.push("ET");
  const stream = content.join("\n");
  const length = Buffer.byteLength(stream, "utf8");

  return Buffer.from(
    `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj
4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
5 0 obj<< /Length ${length} >>stream
${stream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000243 00000 n 
0000000313 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
${313 + length + 24}
%%EOF`,
    "utf8"
  );
};

export class TaxAssistantDomainService {
  private readonly taxAssistant = new TaxAssistantService();

  constructor(private readonly app: FastifyInstance) {}

  async getSummary(merchantId: string, financialYear: string) {
    return this.taxAssistant.buildContext(merchantId, financialYear);
  }

  async chat(merchantId: string, question: string, financialYear: string) {
    const context = await this.getSummary(merchantId, financialYear);

    if (!process.env.LLM_API_URL || !process.env.LLM_API_KEY) {
      return {
        answer:
          `Tax context prepared for FY ${financialYear}. External LLM is not configured, so this is a local fallback summary. Revenue: INR ${Number(context.taxRecord?.total_revenue_inr ?? 0).toFixed(2)}. Always consult a CA for legal advice.`,
        context
      };
    }

    const response = await fetch(process.env.LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              question,
              context
            })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new ApiError(502, "LLM request failed");
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      answer: payload.choices?.[0]?.message?.content ?? "No response generated.",
      context
    };
  }

  async generatePdf(merchantId: string, financialYear: string) {
    const context = await this.getSummary(merchantId, financialYear);
    const fileName = `tax-summary-${merchantId}-${financialYear}.pdf`;
    const pdf = buildSimplePdf("Detrix Tax Summary", [
      `Financial Year: ${financialYear}`,
      `Revenue INR: ${Number(context.taxRecord?.total_revenue_inr ?? 0).toFixed(2)}`,
      `Platform Fees INR: ${Number(context.taxRecord?.platform_fees_paid ?? 0).toFixed(2)}`,
      `TDS INR: ${Number(context.taxRecord?.tds_deducted ?? 0).toFixed(2)}`,
      "Consult a CA for legal advice."
    ]);

    const upload = await this.app.supabase.storage
      .from("tax-summaries")
      .upload(fileName, pdf, {
        contentType: "application/pdf",
        upsert: true
      });

    if (upload.error) {
      throw new ApiError(400, upload.error.message);
    }

    const publicUrl = this.app.supabase.storage.from("tax-summaries").getPublicUrl(fileName).data.publicUrl;

    return {
      fileName,
      publicUrl
    };
  }
}

