import { STOPWORDS, JD_FILLER } from "./stopwords";
import { stem } from "./stem";

export type MatchBand = "strong" | "partial" | "weak";

export interface MatchResult {
  score: number;
  band: MatchBand;
  matched: string[];
  missing: string[];
  ok: boolean;
}

const MIN_TOKENS = 8;
const TOP_JD_TERMS = 40;
const STRONG = 75;
const PARTIAL = 45;
const PHRASE_BOOST = 1.2;
const ACRONYM_BOOST = 1.0; // company/product acronyms (PTMA, CFMAX) are guaranteed-missing noise; boosting them over-penalized real fits

const EXCLUDED = new Set<string>([...STOPWORDS, ...JD_FILLER]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

function isPureNumber(t: string): boolean {
  return /^\d+$/.test(t);
}

function isExcluded(t: string): boolean {
  return EXCLUDED.has(t) || isPureNumber(t);
}

function acronymSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split(/[^A-Za-z0-9]+/)) {
    if (raw.length >= 2 && raw.length <= 6 && /^[A-Z0-9]+$/.test(raw) && /[A-Z]/.test(raw)) {
      out.add(raw.toLowerCase());
    }
  }
  return out;
}

type ScoredTerm =
  | { kind: "uni"; token: string; display: string; weight: number }
  | { kind: "bi"; a: string; b: string; display: string; weight: number };

function resumeTokenSet(text: string): Set<string> {
  const set = new Set<string>();
  const acr = acronymSet(text);
  for (const a of acr) set.add(a);
  for (const tok of tokenize(text)) {
    if (isExcluded(tok)) continue;
    set.add(acr.has(tok) ? tok : stem(tok));
  }
  return set;
}

function buildJdTerms(text: string): ScoredTerm[] {
  const tokens = tokenize(text);
  const acr = acronymSet(text);

  const uni = new Map<string, { display: string; freq: number; acronym: boolean }>();
  for (const tok of tokens) {
    if (isExcluded(tok)) continue;
    const isAcr = acr.has(tok);
    const token = isAcr ? tok : stem(tok);
    const cur = uni.get(token);
    if (cur) cur.freq++;
    else uni.set(token, { display: tok, freq: 1, acronym: isAcr });
  }

  const bi = new Map<string, { a: string; b: string; display: string; freq: number }>();
  for (let i = 0; i + 2 <= tokens.length; i++) {
    const ta = tokens[i];
    const tb = tokens[i + 1];
    if (isExcluded(ta) || isExcluded(tb)) continue;
    const a = stem(ta);
    const b = stem(tb);
    const key = a + " " + b;
    const cur = bi.get(key);
    if (cur) cur.freq++;
    else bi.set(key, { a, b, display: ta + " " + tb, freq: 1 });
  }

  const terms: ScoredTerm[] = [];
  for (const [token, v] of uni) {
    terms.push({ kind: "uni", token, display: v.display, weight: v.freq * (v.acronym ? ACRONYM_BOOST : 1) });
  }
  for (const v of bi.values()) {
    terms.push({ kind: "bi", a: v.a, b: v.b, display: v.display, weight: v.freq * PHRASE_BOOST });
  }
  terms.sort((x, y) => y.weight - x.weight);
  return terms.slice(0, TOP_JD_TERMS);
}

function isMatched(term: ScoredTerm, resumeSet: Set<string>): boolean {
  if (term.kind === "uni") return resumeSet.has(term.token);
  return resumeSet.has(term.a) && resumeSet.has(term.b);
}

export function scoreMatch(resumeText: string, jdText: string): MatchResult {
  const empty: MatchResult = { score: 0, band: "weak", matched: [], missing: [], ok: false };
  if (tokenize(resumeText).length < MIN_TOKENS || tokenize(jdText).length < MIN_TOKENS) {
    return empty;
  }

  const jdTerms = buildJdTerms(jdText);
  const resumeSet = resumeTokenSet(resumeText);

  let total = 0;
  let hit = 0;
  const matched: { display: string; weight: number }[] = [];
  const missing: { display: string; weight: number }[] = [];
  for (const t of jdTerms) {
    total += t.weight;
    if (isMatched(t, resumeSet)) {
      hit += t.weight;
      matched.push({ display: t.display, weight: t.weight });
    } else {
      missing.push({ display: t.display, weight: t.weight });
    }
  }

  const score = total > 0 ? Math.round((100 * hit) / total) : 0;
  const band: MatchBand = score >= STRONG ? "strong" : score >= PARTIAL ? "partial" : "weak";

  return {
    score,
    band,
    matched: matched.sort((a, b) => b.weight - a.weight).map((m) => m.display),
    missing: missing.sort((a, b) => b.weight - a.weight).map((m) => m.display),
    ok: true,
  };
}
