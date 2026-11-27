import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { z } from "zod";
import { cards } from "@/lib/cards";
import { scoreAnswer, type Guess } from "@/lib/scoring";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("queue"), participantId: z.string().uuid() }),
  z.object({ action: z.literal("status"), participantId: z.string().uuid(), matchId: z.string().uuid() }),
  z.object({
    action: z.literal("answer"),
    participantId: z.string().uuid(),
    matchId: z.string().uuid(),
    guess: z.enum(["phishing", "legitimate"]),
    confidence: z.number().int().min(1).max(5),
  }),
]);

const queueScript = `
local participant = ARGV[1]
local proposed_match = ARGV[2]
local card_id = ARGV[3]
local now_ms = tonumber(ARGV[4])
local match_prefix = KEYS[2]
local match_key_prefix = KEYS[3]
local current_match = redis.call('GET', match_prefix .. participant)
if current_match then
  return cjson.encode({state='matched', matchId=current_match})
end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms - 120000)
redis.call('ZADD', KEYS[1], now_ms, participant)
local queue = redis.call('ZRANGE', KEYS[1], 0, 20)
for _, other in ipairs(queue) do
  if other ~= participant and not redis.call('GET', match_prefix .. other) then
    redis.call('ZREM', KEYS[1], participant, other)
    redis.call('SET', match_prefix .. participant, proposed_match, 'EX', 600)
    redis.call('SET', match_prefix .. other, proposed_match, 'EX', 600)
    local match_key = match_key_prefix .. proposed_match
    redis.call('HSET', match_key, 'p1', other, 'p2', participant, 'cardId', card_id, 'state', 'active')
    redis.call('EXPIRE', match_key, 600)
    return cjson.encode({state='matched', matchId=proposed_match})
  end
end
return cjson.encode({state='waiting'})
`;

function redisClient() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return Redis.fromEnv();
}

export async function POST(request: Request) {
  const redis = redisClient();
  if (!redis) return Response.json({ error: "Ranked play is not configured." }, { status: 503 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid ranked-play request." }, { status: 400 });
  const input = parsed.data;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "threat-terminal:ranked-rate",
  });
  const rate = await limiter.limit(input.participantId);
  if (!rate.success) return Response.json({ error: "Slow down and try again in a moment." }, { status: 429 });

  const matchForKey = `threat-terminal:ranked:player:${input.participantId}`;
  const matchKey = `threat-terminal:ranked:match:${input.matchId}`;

  if (input.action === "queue") {
    const proposedMatchId = crypto.randomUUID();
    const selectedCard = cards[Math.floor(Math.random() * cards.length)];
    const resultText = await redis.eval<string>(
      queueScript,
      ["threat-terminal:ranked:queue", "threat-terminal:ranked:player:", "threat-terminal:ranked:match:"],
      [input.participantId, proposedMatchId, selectedCard.id, Date.now()],
    );
    const result = JSON.parse(resultText) as { state: "waiting" | "matched"; matchId?: string };
    if (result.state === "waiting" || !result.matchId) {
      return Response.json({ state: "waiting", retryAfterMs: 4000 });
    }
    const details = await redis.hgetall<Record<string, string>>(`threat-terminal:ranked:match:${result.matchId}`);
    return Response.json({ state: "matched", matchId: result.matchId, cardId: details?.cardId });
  }

  const currentMatch = await redis.get<string>(matchForKey);
  if (currentMatch !== input.matchId) return Response.json({ error: "Match not found for this participant." }, { status: 404 });
  const details = await redis.hgetall<Record<string, string>>(matchKey);
  if (!details?.cardId || (details.p1 !== input.participantId && details.p2 !== input.participantId)) {
    return Response.json({ error: "Match is unavailable." }, { status: 404 });
  }
  const card = cards.find((item) => item.id === details.cardId);
  if (!card) return Response.json({ error: "The match card is no longer available." }, { status: 409 });

  if (input.action === "status") {
    const ownAnswer = await redis.hget<string>(matchKey, `answer:${input.participantId}`);
    const otherId = details.p1 === input.participantId ? details.p2 : details.p1;
    const otherAnswer = await redis.hget<string>(matchKey, `answer:${otherId}`);
    const result = await redis.hget<string>(matchKey, "result");
    return Response.json({
      state: details.state,
      matchId: input.matchId,
      cardId: details.cardId,
      answered: Boolean(ownAnswer),
      opponentAnswered: Boolean(otherAnswer),
      result: result ? JSON.parse(result) : null,
    });
  }

  if (details.state !== "active") return Response.json({ error: "This match has already finished." }, { status: 409 });
  const answerKey = `answer:${input.participantId}`;
  const correct = scoreAnswer(card, input.guess as Guess, input.confidence);
  const accepted = await redis.hsetnx(matchKey, answerKey, JSON.stringify({
    correct: correct.correct,
    points: correct.points,
    confidence: correct.confidence,
  }));
  if (!accepted) return Response.json({ error: "This participant has already answered." }, { status: 409 });

  const players = [details.p1, details.p2].filter(Boolean) as string[];
  const answers = await Promise.all(players.map((player) => redis.hget<string>(matchKey, `answer:${player}`)));
  let result: { winner: string | null; scores: Record<string, number> } | null = null;
  if (answers.every(Boolean)) {
    const scores: Record<string, number> = {};
    players.forEach((player, index) => {
      const answer = JSON.parse(answers[index]!) as { points: number };
      scores[player] = answer.points;
    });
    const winner = scores[players[0]] === scores[players[1]] ? null : scores[players[0]] > scores[players[1]] ? players[0] : players[1];
    const candidate = { winner, scores };
    const finalized = await redis.hsetnx(matchKey, "finalized", "1");
    if (finalized) {
      await Promise.all(players.map((player) => redis.zincrby("threat-terminal:ranked:leaderboard", scores[player], player)));
      await redis.hset(matchKey, { state: "complete", result: JSON.stringify(candidate) });
    }
    result = candidate;
  }
  return Response.json({ accepted: true, opponentAnswered: Boolean(result), result });
}

