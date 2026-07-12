/**
 * Client-side heuristic checker for ghost jobs and scam job postings.
 *
 * Paste a job posting; we scan for well-documented red flags (upfront-payment
 * scams, personal-email contact, chat-app interviews, MLM language, missing
 * comp, vague descriptions). Deterministic + regex-based — nothing leaves the
 * browser. It's a starting point, not a verdict: legitimate postings can trip a
 * flag or two, and clever scams can avoid them.
 */

export type RiskBand = "high" | "caution" | "low";

export interface RiskFlag {
  label: string;
  detail: string;
  weight: number;
}

export interface GhostJobResult {
  score: number; // 0-100 risk
  band: RiskBand;
  flags: RiskFlag[];
  positives: string[];
  ok: boolean;
}

const MIN_WORDS = 12;
const HIGH = 60;
const CAUTION = 25;

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

interface Check {
  label: string;
  detail: string;
  weight: number;
  test: (lower: string, raw: string) => boolean;
}

// Each check is a documented scam/ghost-job signal. Weights are tuned so a
// single common-but-benign signal (e.g. no salary) reads as "caution", while
// the classic scam tells (sensitive info, upfront payment, chat-app hiring)
// push firmly into "high".
const CHECKS: Check[] = [
  {
    label: "Asks for sensitive personal/financial info",
    detail:
      "Legit employers never need your SSN, bank/routing number, or a photo of your ID before an offer. This is the #1 sign of a scam.",
    weight: 45,
    test: (l) =>
      /\b(social security( number)?|ssn|bank (account|details)|routing number|credit card|driver'?s licen[sc]e|passport (number|photo)|date of birth)\b/.test(
        l,
      ) && /\b(provide|send|share|upload|enter|need|require|verify|confirm)\b/.test(l),
  },
  {
    label: "Asks for money upfront",
    detail:
      "Training fees, starter kits, equipment deposits, or 'registration' payments are never required by a real job. Money should flow to you.",
    weight: 45,
    test: (l) =>
      /\b(training fee|starter kit|registration fee|equipment (fee|deposit)|onboarding fee|application fee|processing fee|pay (a |an )?(fee|deposit)|upfront (cost|payment|fee))\b/.test(
        l,
      ),
  },
  {
    label: "Hiring / interview over a chat app",
    detail:
      "Being told to continue on Telegram, WhatsApp, Signal, or 'Google Hangouts chat' instead of a real interview is a hallmark of job scams.",
    weight: 40,
    test: (l) =>
      /\b(telegram|whatsapp|signal app|google hangouts|hangouts chat|text me at|message me on|contact me on (telegram|whatsapp|signal))\b/.test(
        l,
      ),
  },
  {
    label: "Personal email as the contact",
    detail:
      "A free personal inbox (gmail, yahoo, outlook, hotmail) as the official contact — instead of a company domain — is a common scam/low-trust signal.",
    weight: 25,
    test: (l) => /\b[a-z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|aol|icloud|proton(mail)?)\.[a-z.]+/.test(l),
  },
  {
    label: "Too-good-to-be-true / get-rich language",
    detail:
      "Phrases like 'unlimited earning potential', 'be your own boss', or 'financial freedom' are classic MLM / pyramid recruiting, not real roles.",
    weight: 22,
    test: (l) =>
      /\b(unlimited (earning|income|earnings)|be your own boss|financial freedom|earn up to \$?\d|quick (money|cash)|easy money|get rich|six figures from home)\b/.test(
        l,
      ),
  },
  {
    label: "Weekly pay framing for an entry role",
    detail:
      "Scams often quote pay 'per week' (e.g. '$900/week, no experience') to look attractive while hiding an annual figure.",
    weight: 18,
    test: (l) =>
      /\$\s?\d[\d,]*\s*(\/|\s?per\s?)\s?(week|wk|day)\b/.test(l) &&
      /\bno experience\b/.test(l),
  },
  {
    label: "Commission-only / no base pay",
    detail:
      "Roles advertised as '100% commission' with no base can be legitimate, but are frequently churn-and-burn or recruiting funnels. Verify before investing time.",
    weight: 12,
    test: (l) => /\b(100% commission|commission[- ]only|no base (pay|salary)|straight commission)\b/.test(l),
  },
  {
    label: "Urgency / mass-hiring pressure",
    detail:
      "'Start immediately', 'hiring 20+ today', 'apply now before it's gone' pressure is used to rush you past normal vetting.",
    weight: 10,
    test: (l) =>
      /\b(start (today|immediately|asap)|immediate start|hiring (multiple|several|\d+\+? )?(people|positions|candidates)|apply now before|limited spots)\b/.test(
        l,
      ),
  },
  {
    label: "No compensation mentioned",
    detail:
      "Not disqualifying on its own, but ghost jobs and low-quality posts often omit any pay range. Genuine, serious postings increasingly include one.",
    weight: 10,
    test: (l) =>
      !/(\$\s?\d|\bsalary\b|\bcompensation\b|\bpay range\b|per (hour|year|annum)|\bk\/yr\b|\bbenefits\b)/.test(l),
  },
  {
    label: "Very short / vague description",
    detail:
      "A posting with almost no specific responsibilities or requirements is a ghost-job signal — it may be collecting résumés rather than hiring.",
    weight: 10,
    test: (_l, raw) => wordCount(raw) < 45,
  },
  {
    label: "Generic 'no experience, work from home, flexible'",
    detail:
      "The combination of 'no experience needed' + 'work from home' + 'flexible hours' with little else is a frequent reshipping/payment-processing scam pattern.",
    weight: 14,
    test: (l) =>
      /\bno experience\b/.test(l) && /\b(work from home|remote|wfh)\b/.test(l) && /\bflexible\b/.test(l),
  },
];

function positivesFor(lower: string): string[] {
  const out: string[] = [];
  if (/(\$\s?\d|\bsalary\b|\bcompensation\b|pay range|per (hour|year|annum))/.test(lower)) {
    out.push("Lists compensation");
  }
  if (/\b(greenhouse|lever|workday|ashby|smartrecruiters|icims|jobvite|bamboohr)\b/.test(lower)) {
    out.push("Mentions a known applicant tracking system");
  }
  if (/\b(responsibilities|requirements|qualifications|you'?ll|what you'?ll do)\b/.test(lower)) {
    out.push("Has a real responsibilities/requirements section");
  }
  return out;
}

export function checkGhostJob(text: string): GhostJobResult {
  const empty: GhostJobResult = { score: 0, band: "low", flags: [], positives: [], ok: false };
  if (wordCount(text) < MIN_WORDS) return empty;

  const lower = text.toLowerCase();
  const flags: RiskFlag[] = [];
  let score = 0;
  for (const c of CHECKS) {
    if (c.test(lower, text)) {
      flags.push({ label: c.label, detail: c.detail, weight: c.weight });
      score += c.weight;
    }
  }
  score = Math.min(100, score);
  const band: RiskBand = score >= HIGH ? "high" : score >= CAUTION ? "caution" : "low";

  return {
    score,
    band,
    flags: flags.sort((a, b) => b.weight - a.weight),
    positives: positivesFor(lower),
    ok: true,
  };
}
