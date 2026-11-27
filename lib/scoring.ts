import type { EmailCard } from "@/lib/cards";

export type Guess = "phishing" | "legitimate";

export function scoreAnswer(card: EmailCard, guess: Guess, confidence: number) {
  const correct = (guess === "phishing") === card.isPhishing;
  const certainty = Math.max(1, Math.min(5, confidence));
  const points = correct ? 100 + certainty * 10 : Math.max(0, 20 - certainty * 5);
  return { correct, points, confidence: certainty };
}

export function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function dailyCards<T extends { id: string }>(items: T[], date = new Date(), count = 5): T[] {
  if (items.length <= count) return items;
  const seed = Array.from(dateKey(date)).reduce((total, char) => total + char.charCodeAt(0), 0);
  return Array.from({ length: count }, (_, index) => items[(seed + index * 7) % items.length]);
}

