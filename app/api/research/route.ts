import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const responseSchema = z.object({
  participantId: z.string().uuid(),
  cardId: z.string().regex(/^(tt-[0-9]{3,5}|tt-gen-[0-9]{4})$/),
  technique: z.enum(["urgency", "authority-impersonation", "credential-harvest", "hyper-personalization", "pretexting", "fluent-prose", "legitimate"]),
  guess: z.enum(["phishing", "legitimate"]),
  correct: z.boolean(),
  confidence: z.number().int().min(1).max(5),
  responseMs: z.number().int().min(0).max(900_000),
  inspectedForensics: z.boolean(),
  background: z.enum(["security", "it", "student", "other"]).optional(),
});

export async function POST(request: Request) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Research storage is not configured." }, { status: 503 });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON research response." }, { status: 400 });
  }
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Response fields did not validate." }, { status: 400 });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.from("research_answers").insert({
    participant_id: parsed.data.participantId,
    card_id: parsed.data.cardId,
    technique: parsed.data.technique,
    guess: parsed.data.guess,
    correct: parsed.data.correct,
    confidence: parsed.data.confidence,
    response_ms: parsed.data.responseMs,
    inspected_forensics: parsed.data.inspectedForensics,
    background: parsed.data.background ?? null,
    study_version: "0.1.0",
  });
  if (error) return Response.json({ error: "Could not record the response." }, { status: 502 });
  return Response.json({ recorded: true }, { status: 201 });
}

