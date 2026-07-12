# SearchSteward

**A job-search radar that watches company career pages for you.**
Official site: **[searchsteward.com](https://searchsteward.com)**

SearchSteward is a proactive job-search tool. Instead of scrolling job boards,
it monitors **40,000+ company career pages** directly and scores every new
opening against your résumé the day it's posted — so well-matched roles find
you, not the other way around.

This repo is the developer face of the product: what it looks like, how it's
built at a high level, and the parts of the engine we open-source.

## What it does

- **Career-page radar** — tracks tens of thousands of employer career pages
  daily and surfaces new, on-target roles as they appear.
- **AI résumé ↔ role scoring** — every opening scored against your background,
  with the matched keywords and the *why* shown, not just a number.
- **Ghost Job Detector** — flags stale, perpetually-reposted, or never-filled
  listings *at the source*, so you don't waste applications. Because we pull
  straight from company career pages — not aggregators, where ghost jobs pile
  up — we know when a listing first appeared and how it left.
- **Application tracking & insights** — keep every role and its status in one
  place, and see where your funnel actually stalls.

## A quick tour

**Matches, scored and explained.** Every role gets a fit score against your
résumé and search settings, with lanes for your target companies:

![Job matches scored against your profile](assets/matches.png)

**Every score shows its work.** Click into any match: the score breakdown,
matched keywords, ranking rationale — and the ghost-posting check — are all
visible:

![Job detail with score breakdown and ghost-posting flags](assets/job-detail.png)

**Your funnel, diagnosed.** Insights shows conversion at each stage, which
résumé version is out-performing, and where applications are going stale:

![Insights funnel and what's-working analytics](assets/insights.png)

**The front door:**

![SearchSteward landing page](assets/landing.png)

## Open-source modules

We open-source the pieces where transparency *is* the feature. Both are
MIT-licensed, dependency-free, and are the same code running in production.

### [`resume-match/`](resume-match/) — Résumé ↔ JD matcher + ghost-posting checker (TypeScript)

The engines behind our free, no-signup tools. Both run entirely in your
browser — pasted text never leaves the page, and publishing the source is how
we back that claim up.

- `scoreMatch()` — keyword-coverage scoring with stemming, acronym handling,
  phrase boosting, and JD-filler suppression. Powers
  [searchsteward.com/tools/resume-match](https://searchsteward.com/tools/resume-match).
- `checkGhostJob()` — a weighted checklist of documented scam/ghost-posting
  signals with human-readable explanations. Powers
  [searchsteward.com/tools/ghost-job-checker](https://searchsteward.com/tools/ghost-job-checker).

### [`ghost-signal/`](ghost-signal/) — Production ghost-job signal (Python)

The actual decision logic behind the in-app ghost-job badge: pure, I/O-free,
and deliberately conservative. Absence of evidence yields `unknown`, never
`clean`; every tier carries its reasons; and market-universal noise (like a
missing salary) is recorded but never counted against a listing. The README
documents every signal and weight.

## How it's built

A single product, three layers:

- **Ingestion (Python).** A scraping engine with per-ATS adapters (Greenhouse,
  Lever, Workday, Ashby, SmartRecruiters, Workable, and many more) sweeps
  company career pages on a continuous cycle, normalizes listings, and tracks
  each posting's lifecycle — first seen, changed, closed. Board health is
  monitored and self-healing: moved or renamed career pages are rediscovered
  rather than dropped.
- **Matching (Python).** A two-stage scoring funnel: fast hard gates
  (location, disqualifiers) followed by a weighted relevance model tuned per
  user from their résumé and search settings. LLM analysis runs on top for
  fit narratives, résumé tailoring, and negotiation prep.
- **Product (TypeScript).** A Next.js/React app backed by a FastAPI service
  and PostgreSQL.

The scoring weights, gate tuning, ATS adapter details, and company registry
are the proprietary core and stay closed — what we open-source instead are the
user-facing checks where seeing the logic is the point.

## Free tools (no signup)

- **Résumé ↔ Job-Description Matcher** — https://searchsteward.com/tools/resume-match
- **Ghost Job Detector** — https://searchsteward.com/tools/ghost-job-checker

## Links

- Website: https://searchsteward.com
- LinkedIn: https://www.linkedin.com/company
- X: https://x.com/SearchSteward
- Crunchbase: https://www.crunchbase.com/organization/searchsteward

_Built for active job seekers who want signal over noise._
