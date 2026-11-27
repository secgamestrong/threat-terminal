"use client";

import { useEffect, useMemo, useState } from "react";
import { cards, phishingTechniqueLabels, type EmailCard } from "@/lib/cards";
import { dailyCards, scoreAnswer, type Guess } from "@/lib/scoring";

type Mode = "freeplay" | "daily" | "research" | "ranked";
type RankedState = "idle" | "searching" | "matched" | "answered" | "complete" | "error";

interface Result {
  card: EmailCard;
  guess: Guess;
  correct: boolean;
  points: number;
  confidence: number;
  elapsedMs: number;
  inspectedForensics: boolean;
}

interface RankedResult {
  winner: string | null;
  scores: Record<string, number>;
}

const modeLabels: Record<Mode, string> = {
  freeplay: "Freeplay",
  daily: "Daily challenge",
  research: "Research mode",
  ranked: "Ranked 1v1",
};

function getParticipantId() {
  let id = localStorage.getItem("tt-participant-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("tt-participant-id", id);
  }
  return id;
}

export default function ThreatTerminal() {
  const [mode, setMode] = useState<Mode>("freeplay");
  const [round, setRound] = useState<EmailCard[]>(cards);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [locked, setLocked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confidence, setConfidence] = useState(3);
  const [results, setResults] = useState<Result[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [consent, setConsent] = useState(false);
  const [background, setBackground] = useState("");
  const [researchMessage, setResearchMessage] = useState("");
  const [forensicsOpened, setForensicsOpened] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [participantId, setParticipantId] = useState("");
  const [rankedState, setRankedState] = useState<RankedState>("idle");
  const [rankedMatchId, setRankedMatchId] = useState("");
  const [rankedResult, setRankedResult] = useState<RankedResult | null>(null);
  const [rankedMessage, setRankedMessage] = useState("");

  const current = round[index];
  const score = useMemo(() => results.reduce((sum, result) => sum + result.points, 0), [results]);
  const correctCount = useMemo(() => results.filter((result) => result.correct).length, [results]);

  useEffect(() => {
    const saved = Number(localStorage.getItem("tt-xp") ?? 0);
    if (Number.isFinite(saved)) setTotalXp(saved);
    setParticipantId(getParticipantId());
  }, []);

  function start(selectedMode: Mode) {
    setMode(selectedMode);
    setRound(selectedMode === "ranked" ? [] : selectedMode === "daily" ? dailyCards(cards, new Date(), 5) : [...cards]);
    setIndex(0);
    setGuess(null);
    setLocked(false);
    setFinished(false);
    setConfidence(3);
    setResults([]);
    setConsent(false);
    setBackground("");
    setForensicsOpened(false);
    setResearchMessage("");
    setStartedAt(Date.now());
    setRankedMatchId("");
    setRankedResult(null);
    setRankedMessage(selectedMode === "ranked" ? "Looking for another player…" : "");
    setRankedState(selectedMode === "ranked" ? "searching" : "idle");
  }

  async function submitAnswer() {
    if (!current || !guess) return;
    const result = scoreAnswer(current, guess, confidence);
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const item: Result = {
      card: current,
      guess,
      correct: result.correct,
      points: result.points,
      confidence: result.confidence,
      elapsedMs,
      inspectedForensics: forensicsOpened,
    };

    if (mode === "ranked") {
      try {
        const response = await fetch("/api/ranked", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "answer", participantId, matchId: rankedMatchId, guess, confidence }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Your answer could not be submitted.");
        setResults((previous) => [...previous, item]);
        setLocked(true);
        setRankedState("answered");
        setRankedMessage("Answer locked. Waiting for the other player to submit.");
      } catch (error) {
        setRankedMessage(error instanceof Error ? error.message : "Ranked play could not be reached.");
        setRankedState("error");
      }
      return;
    }

    setResults((previous) => [...previous, item]);
    setLocked(true);
    if (mode === "research" && consent) {
      try {
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            participantId,
            cardId: current.id,
            technique: current.technique,
            guess,
            correct: result.correct,
            confidence: result.confidence,
            responseMs: elapsedMs,
            inspectedForensics: forensicsOpened,
            background: background || undefined,
          }),
        });
        setResearchMessage(response.ok ? "Your pseudonymous response was recorded." : "Research storage is not configured; this answer stayed in this browser.");
      } catch {
        setResearchMessage("Research storage could not be reached; this answer stayed in this browser.");
      }
    }
  }

  function nextCard() {
    if (index + 1 >= round.length) {
      const gained = results.reduce((sum, result) => sum + result.points, 0);
      const updated = totalXp + gained;
      setTotalXp(updated);
      localStorage.setItem("tt-xp", String(updated));
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setGuess(null);
    setLocked(false);
    setConfidence(3);
    setForensicsOpened(false);
    setStartedAt(Date.now());
  }

  useEffect(() => {
    if (mode !== "ranked" || rankedState !== "searching" || !participantId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function pollQueue() {
      try {
        const response = await fetch("/api/ranked", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "queue", participantId }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Ranked queue is unavailable.");
        if (payload.state === "matched") {
          const matchCard = cards.find((card) => card.id === payload.cardId);
          if (!matchCard || !payload.matchId) throw new Error("The match referenced a card missing from this deck.");
          if (cancelled) return;
          setRankedMatchId(payload.matchId);
          setRound([matchCard]);
          setIndex(0);
          setGuess(null);
          setLocked(false);
          setStartedAt(Date.now());
          setRankedState("matched");
          setRankedMessage("Opponent found. Read the message and lock your classification.");
          return;
        }
        if (!cancelled) {
          setRankedMessage("Waiting for an opponent. This screen checks the queue every few seconds.");
          timer = setTimeout(pollQueue, 4000);
        }
      } catch (error) {
        if (cancelled) return;
        setRankedMessage(error instanceof Error ? error.message : "Ranked play could not be reached.");
        setRankedState("error");
      }
    }

    void pollQueue();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, participantId, rankedState]);

  useEffect(() => {
    if (mode !== "ranked" || rankedState !== "answered" || !rankedMatchId || !participantId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function pollMatch() {
      try {
        const response = await fetch("/api/ranked", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "status", participantId, matchId: rankedMatchId }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Match status is unavailable.");
        if (payload.result) {
          if (cancelled) return;
          const outcome = payload.result as RankedResult;
          setRankedResult(outcome);
          setRankedState("complete");
          setRankedMessage("Match complete.");
          const earned = outcome.scores[participantId] ?? 0;
          const updated = Number(localStorage.getItem("tt-xp") ?? 0) + earned;
          localStorage.setItem("tt-xp", String(updated));
          setTotalXp(updated);
          return;
        }
        if (!cancelled) {
          setRankedMessage(payload.opponentAnswered ? "Your opponent has answered. Finalizing the match…" : "Answer locked. Waiting for the other player to submit.");
          timer = setTimeout(pollMatch, 4000);
        }
      } catch (error) {
        if (cancelled) return;
        setRankedMessage(error instanceof Error ? error.message : "Match status could not be reached.");
        setRankedState("error");
      }
    }

    void pollMatch();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, participantId, rankedMatchId, rankedState]);

  const complete = finished;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">TT//</span>
          <div><div className="brand-name">Threat Terminal</div><div className="brand-meta">PHISHING LITERACY · RESEARCH PREVIEW</div></div>
        </div>
        <span className="status"><i className="status-dot" /> dataset online</span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Can you spot the signal?</p>
          <h1>Polished writing is not proof of trust.</h1>
          <p className="hero-copy">Classify fictional email examples, rate your confidence, then inspect the forensic signals. The exercise asks whether people can still distinguish malicious mail when both sides read smoothly.</p>
        </div>
        <div className="hero-side"><strong>How to play</strong><br />Read the message before opening the forensic panel. Pick phishing or legitimate, set confidence, and compare your reasoning with the evidence. No real credentials or real URLs are used in the demo deck.</div>
      </section>

      <nav className="modebar" aria-label="Game mode">
        {(Object.keys(modeLabels) as Mode[]).map((key) => (
          <button key={key} className="mode-button" aria-pressed={mode === key} onClick={() => start(key)}>{modeLabels[key]}</button>
        ))}
      </nav>

      {mode === "ranked" && round.length === 0 ? (
        <section className="panel match-panel" aria-live="polite">
          <p className="eyebrow">Ranked 1v1 · beta</p>
          <h2>{rankedState === "error" ? "Ranked play is unavailable" : "Finding a match"}</h2>
          <p className="hero-copy">{rankedMessage}</p>
          {rankedState === "error" && <button className="button primary" onClick={() => start("ranked")}>Try again</button>}
          <p className="brand-meta">Ranked play requires the server-side Upstash Redis settings shown in <code>.env.example</code>.</p>
        </section>
      ) : complete ? (
        <section className="panel summary" aria-live="polite">
          <p className="eyebrow">Session complete</p>
          <h2>Good signals come from checking context.</h2>
          <div className="summary-grid">
            <div className="summary-card"><strong>{correctCount}/{round.length}</strong><span>correct classifications</span></div>
            <div className="summary-card"><strong>{score}</strong><span>session points</span></div>
            <div className="summary-card"><strong>{totalXp}</strong><span>career XP</span></div>
          </div>
          <p className="hero-copy">Confidence is useful when it is calibrated. Review the misses before treating one signal as decisive.</p>
          {researchMessage && <p className="brand-meta" role="status">{researchMessage}</p>}
          <button className="button primary" onClick={() => start(mode)}>Play another round</button>
        </section>
      ) : current ? (
        <div className="game-grid">
          <section className="panel">
            <div className="panel-header"><h2 className="panel-title">Incoming message / {current.id}</h2><span className="counter">{index + 1} / {round.length}</span></div>
            <article className="email" aria-label="Email example">
              <dl className="email-meta">
                <div><dt>FROM</dt><dd>{current.from}</dd></div>
                {current.replyTo && <div><dt>REPLY</dt><dd>{current.replyTo}</dd></div>}
                <div><dt>RECEIVED</dt><dd>{current.sentAt} local</dd></div>
              </dl>
              <h3 className="subject">{current.subject}</h3>
              <p className="message">{current.body}</p>
              {current.url && <p className="url-chip" aria-label="Displayed link destination">↗ {current.url}</p>}
              {current.attachment && <p className="attachment">▤ {current.attachment}</p>}
            </article>

            {mode === "research" && (
              <div className="email">
                <label className="research-consent">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span>Optional research contribution: share my pseudonymous answer, confidence, response time, and forensic-panel interaction. No name or email is requested. You can play without contributing.</span>
                </label>
                {consent && <label className="brand-meta">Professional background (optional) <select value={background} onChange={(event) => setBackground(event.target.value)}><option value="">Prefer not to say</option><option value="security">Security</option><option value="it">IT / Engineering</option><option value="student">Student</option><option value="other">Other</option></select></label>}
              </div>
            )}

            {!locked ? (
              <>
                <details className="forensics" onToggle={(event) => setForensicsOpened(event.currentTarget.open)}>
                  <summary>Inspect sender authentication and message clues</summary>
                  <div className="signal-list">
                    <div className="signal"><i className="signal-mark" /><span><strong>SPF / DKIM / DMARC</strong><br />SPF {current.auth.spf} · DKIM {current.auth.dkim} · DMARC {current.auth.dmarc}</span></div>
                    {current.signals.map((signal) => <div className="signal" key={signal.label}><i className="signal-mark" /><span><strong>{signal.label}: {signal.observed}</strong><br />{signal.meaning}</span></div>)}
                  </div>
                </details>
                <div className="choices">
                  <button className="choice phish" aria-pressed={guess === "phishing"} onClick={() => setGuess("phishing")}>Report as phishing</button>
                  <button className="choice legit" aria-pressed={guess === "legitimate"} onClick={() => setGuess("legitimate")}>Looks legitimate</button>
                </div>
                <div className="confidence"><label htmlFor="confidence"><span>Confidence</span><span>{confidence} / 5</span></label><input id="confidence" type="range" min="1" max="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></div>
                <div className="actions"><button className="button primary" disabled={!guess} onClick={submitAnswer}>Lock classification</button></div>
              </>
            ) : mode === "ranked" ? (
              <div className="feedback" aria-live="polite">
                {rankedResult ? (
                  <>
                    <h3>{rankedResult.winner === null ? "Match drawn" : rankedResult.winner === participantId ? "You won the round" : "Your opponent won the round"}</h3>
                    <p>You scored {rankedResult.scores[participantId] ?? 0} points. {rankedMessage}</p>
                    <h3>Classification: {current.isPhishing ? "Phishing" : "Legitimate"}</h3>
                    <p>{current.explanation}</p>
                    <div className="actions" style={{ padding: "16px 0 0" }}><button className="button primary" onClick={() => start("ranked")}>Find another opponent</button></div>
                  </>
                ) : <><h3>Answer locked</h3><p>{rankedMessage}</p></>}
              </div>
            ) : (
              <div className={`feedback ${guess === (current.isPhishing ? "phishing" : "legitimate") ? "good" : "bad"}`}>
                <h3>{guess === (current.isPhishing ? "phishing" : "legitimate") ? "Good call" : "Take another look next time"} · {current.isPhishing ? "Phishing" : "Legitimate"}</h3>
                <p>{current.explanation}</p>
                <p className="brand-meta">Technique: {phishingTechniqueLabels[current.technique]} · confidence {confidence}/5</p>
                <div className="signal-list">{current.signals.map((signal) => <div className="signal" key={signal.label}><i className="signal-mark" /><span><strong>{signal.label}: {signal.observed}</strong><br />{signal.meaning}</span></div>)}</div>
                <div className="actions" style={{ padding: "16px 0 0" }}><button className="button primary" onClick={nextCard}>{index + 1 === round.length ? "Finish session" : "Next message"}</button></div>
              </div>
            )}
          </section>

          <aside className="panel side-panel">
            <h2>{mode === "ranked" ? "Match status" : "Session telemetry"}</h2>
            <div className="score">{score}</div><div className="score-label">points this round</div>
            <div className="progress" role="progressbar" aria-valuenow={index + (locked ? 1 : 0)} aria-valuemin={0} aria-valuemax={round.length}><span style={{ width: `${((index + (locked ? 1 : 0)) / round.length) * 100}%` }} /></div>
            <div className="mini-stat"><span>Correct</span><strong>{correctCount}</strong></div>
            <div className="mini-stat"><span>Career XP</span><strong>{totalXp}</strong></div>
            <div className="mini-stat"><span>Mode</span><strong>{modeLabels[mode]}</strong></div>
            {mode === "ranked" && <div className="mini-stat"><span>State</span><strong>{rankedState}</strong></div>}
            <div className="mini-stat"><span>Forensic view</span><strong>{forensicsOpened ? "Opened" : "Not opened"}</strong></div>
            <p className="brand-meta" style={{ marginTop: 16 }}>{mode === "ranked" ? "Ranked answers and match scores are held temporarily by the configured server." : "Answer data stays in this browser unless you enter Research Mode and opt in."}</p>
          </aside>
        </div>
      ) : null}

      <footer className="footer">All email samples and domains in this starter deck are fictional. SPF, DKIM, and DMARC indicators are scenario cues, not live DNS checks. Research Mode is opt-in and requires a configured server-side storage project.</footer>
    </main>
  );
}

