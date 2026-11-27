# Threat Terminal

A local-first phishing-literacy game and opt-in research prototype. Players classify fictional email scenarios, record confidence, inspect sender and message signals, and compare their choices with an explicit explanation.

## What is in this repository

- Freeplay and date-seeded daily challenge modes.
- A small, fictional starter deck with safe `.example` domains and no working credential or payment links.
- Confidence-weighted scoring and browser-local XP.
- Optional Research Mode. It sends pseudonymous answer telemetry only after a player checks the consent box.
- Optional ranked one-card matches backed by Upstash Redis.
- A command-line card-authoring script. It can request additional fictional scenarios from an Anthropic model; the API key is used only by the local script and never enters the browser bundle.
- A Supabase schema and server route for research data.

The repository starts with 12 hand-authored scenarios. That is a demo deck, not a study sample or a reproduction of any published participant count. Generated scenarios require human review before being used in a study. No research result or participant total is inferred from the demo data.

## Run locally

Requires Node.js 20.9 or later and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Freeplay and the daily challenge work without external services. For a production build, run `npm run build` and `npm start`.

## Optional generated cards

The authoring script requires an Anthropic API key and an account-accessible model name. It writes to `data/generated/cards.json`; generated content is not silently overwritten.

```bash
$env:ANTHROPIC_API_KEY="your-key"
$env:ANTHROPIC_MODEL="your-enabled-model"
$env:CARD_COUNT="20"
npm run generate:cards
```

Use shell-specific environment syntax on macOS/Linux. Keep the key out of source control. Review addresses, claims, authentication signals, and explanations before using generated material. The prompt requests fictional `.example` domains and the script should be run only by a deck maintainer.

## Optional Research Mode

Copy `.env.example` to `.env.local`, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and apply `supabase/schema.sql` to a dedicated Supabase project. The service-role key is read only in the server route; it must never use a `NEXT_PUBLIC_` prefix. Research mode is optional and gameplay remains available when storage is unconfigured.

Research rows include a random participant UUID, card and technique identifiers, choice, correctness, confidence, response time, whether the forensic panel was opened, optional background category, and a study version. They intentionally omit names, email addresses, IP addresses, and free-text fields. The UUID is pseudonymous, not anonymous: it links a participant's responses in the table. Review your consent language, retention policy, access controls, and applicable research review requirements before collecting real participant data.

## Optional ranked matches

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`. The backend rate-limits by browser-generated participant UUID and expires queue and match state. The demo has no identity verification or strong anti-cheat guarantee; treat ranked scores as casual game state, not an identity or skill credential.

## Scoring

Correct classifications earn more points at lower stated confidence, while incorrect high-confidence answers lose more. The formula lives in `lib/scoring.ts`; it is a game mechanic, not a validated measure of phishing skill or confidence calibration.

## Safety and data notes

- All starter emails, organizations, sender addresses, and URLs are fictional. `.example` is reserved for documentation and examples.
- SPF, DKIM, and DMARC values are scenario cues, not live DNS or mail-header checks.
- Do not use the training interface to collect real credentials or deliver simulated phishing.
- Research collection defaults to off and requires an explicit per-session opt-in.
- Ranked play uses a random browser UUID and temporary Redis state. Do not add personal identifiers to the match API.

## Project layout

```text
app/                  Next.js pages and server routes
components/           Interactive game UI
lib/                  Fictional deck and scoring logic
scripts/              Local model-assisted card authoring
supabase/schema.sql   Opt-in response table and access policy
```

## License

No license is included yet. Public visibility on GitHub does not grant permission to redistribute or reuse the code.

