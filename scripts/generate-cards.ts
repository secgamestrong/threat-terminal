import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

const cardSchema = z.object({
  id: z.string(),
  technique: z.enum(["urgency", "authority-impersonation", "credential-harvest", "hyper-personalization", "pretexting", "fluent-prose", "legitimate"]),
  isPhishing: z.boolean(),
  from: z.string(),
  replyTo: z.string().optional(),
  sentAt: z.string(),
  subject: z.string(),
  body: z.string(),
  url: z.string().optional(),
  attachment: z.string().optional(),
  auth: z.object({ spf: z.enum(["pass", "fail", "none"]), dkim: z.enum(["pass", "fail", "none"]), dmarc: z.enum(["pass", "fail", "none"]) }),
  explanation: z.string(),
  signals: z.array(z.object({ label: z.string(), observed: z.string(), meaning: z.string() })).min(2),
}).superRefine((card, context) => {
  const addressPattern = /[A-Z0-9._%+-]+@([A-Z0-9.-]+)/gi;
  for (const field of [card.from, card.replyTo ?? ""]) {
    for (const match of field.matchAll(addressPattern)) {
      if (!match[1]?.toLowerCase().endsWith(".example")) {
        context.addIssue({ code: "custom", message: "Email addresses must use the reserved .example domain." });
      }
    }
  }
  if (card.url) {
    try {
      if (!new URL(card.url).hostname.toLowerCase().endsWith(".example")) {
        context.addIssue({ code: "custom", message: "Scenario URLs must use the reserved .example domain." });
      }
    } catch {
      context.addIssue({ code: "custom", message: "Scenario URLs must be valid example-domain URLs." });
    }
  }
});

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY in your environment; never place it in a client bundle.");
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) throw new Error("Set ANTHROPIC_MODEL to a model available to your Anthropic account.");
  const target = Number(process.env.CARD_COUNT ?? "20");
  if (!Number.isInteger(target) || target < 1 || target > 1000) throw new Error("CARD_COUNT must be between 1 and 1000.");

  const examples = [];
  const batches = Math.ceil(target / 10);
  for (let batch = 0; batch < batches; batch++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        system: "Generate fictional email training scenarios only. Never use real people, brands, domains, credentials, payment instructions, functional URLs, or attachments. Use only reserved .example domains for every email address and URL, with harmless placeholders. Return only a JSON array. Each scenario must have 2-4 forensic signals and realistic headers. Half of this batch should be phishing examples using a balanced rotation of urgency, authority-impersonation, credential-harvest, hyper-personalization, pretexting, and fluent-prose; the other half should be legitimate examples.",
        messages: [{ role: "user", content: `Create up to ${Math.min(10, target - examples.length)} varied email cards. JSON fields: id, technique, isPhishing, from, replyTo?, sentAt, subject, body, url? (only .example hosts), attachment?, auth {spf,dkim,dmarc}, explanation, signals [{label,observed,meaning}]. Avoid instructions that could be used to steal credentials or money.` }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API returned ${response.status}.`);
    const payload = await response.json();
    const text = payload.content?.find((part: { type: string }) => part.type === "text")?.text;
    if (typeof text !== "string") throw new Error("No text block returned by the model.");
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const batchCards = z.array(cardSchema).parse(parsed);
    examples.push(...batchCards);
    console.log(`Generated ${examples.length}/${target}`);
  }
  const unique = new Map(examples.map((card) => [card.id, { ...card, id: `tt-gen-${String(examples.indexOf(card) + 1).padStart(4, "0")}` }]));
  if (unique.size < target) throw new Error(`Only ${unique.size} unique cards validated; expected ${target}.`);
  const output = [...unique.values()].slice(0, target);
  await mkdir("data/generated", { recursive: true });
  const outputPath = "data/generated/cards.json";
  const existing = await readFile(outputPath, "utf8").catch(() => "[]");
  const existingCards: unknown = JSON.parse(existing);
  if (Array.isArray(existingCards) && existingCards.length > 0) {
    throw new Error(`${outputPath} already contains cards. Move it aside before generating a replacement.`);
  }
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8" });
  console.log(`Wrote ${output.length} cards to ${outputPath}. Review every card before using it in research.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Card generation failed.");
  process.exitCode = 1;
});

