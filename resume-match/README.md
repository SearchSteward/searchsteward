# @searchsteward/match-tools

The exact TypeScript that powers SearchSteward's free, no-signup tools:

- **[Résumé ↔ Job-Description Matcher](https://searchsteward.com/tools/resume-match)** — `scoreMatch()`
- **[Ghost Job Checker](https://searchsteward.com/tools/ghost-job-checker)** — `checkGhostJob()`

Zero dependencies, fully deterministic, runs entirely in the browser — your
résumé and the job posting never leave the page. This repo is the same code,
published so you can verify that claim (and reuse it).

## `scoreMatch(resumeText, jdText)`

Keyword-coverage scoring, the way ATS filters and skimming recruiters actually
read a résumé:

1. Tokenize both texts; drop stopwords, generic JD filler ("experience",
   "strong", "responsibilities"…), and bare numbers.
2. Aggressively stem so meaning-preserving variants unify
   (`managed` ≈ `management`, `requirements` ≈ `requirement`).
3. Preserve acronyms (SQL, ETL, CPA) as first-class tokens.
4. Take the top 40 JD terms by frequency — bigram phrases get a 1.2× boost —
   and compute weighted coverage against the résumé's token set.

```ts
import { scoreMatch } from "./src/resumeMatch";

const r = scoreMatch(resumeText, jdText);
// { score: 82, band: "strong", matched: [...], missing: [...], ok: true }
```

Bands: `strong` ≥ 75, `partial` ≥ 45, else `weak`. The calibration suite in
`tests/` pins real-world fixtures so the score can't silently inflate.

## `checkGhostJob(postingText)`

A weighted checklist of documented scam and ghost-job signals: upfront-payment
asks, requests for sensitive personal/financial info, chat-app interviews,
personal-email contacts, MLM language, missing compensation, vague stubs.
Every flag returned carries a human-readable explanation of *why* it matters.

```ts
import { checkGhostJob } from "./src/ghostJob";

const r = checkGhostJob(postingText);
// { score: 40, band: "caution", flags: [{ label, detail, weight }...], positives: [...], ok: true }
```

It's a heuristic starting point, not a verdict — a careful scam can avoid
these patterns and a real posting can trip a flag or two.

## Run the tests

```bash
npm install
npm test
```

## License

MIT.
