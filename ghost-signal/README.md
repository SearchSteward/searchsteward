# ghost-signal

The production ghost-job signal from the SearchSteward pipeline — the module
that decides which tier badge (`clean` / `some_flags` / `likely_ghost` /
`unknown`) a listing gets inside the app.

We publish it because a "ghost job detector" is only trustworthy if you can
see how it decides. This is the actual decision logic, unmodified: pure
functions, no I/O, no dependencies beyond the standard library.

## Design principles

- **Absence of evidence → `unknown`, never `clean`.** If we haven't observed a
  listing long enough to judge it, we say so instead of vouching for it.
- **Every tier carries its reasons.** The output is a tier plus the list of
  human-readable reason codes that produced it — nothing is a black box.
- **Biased against false positives.** Calling a real opening a ghost job hurts
  the job seeker. Thresholds are deliberately conservative: it takes weight ≥ 3
  across multiple signals to reach `likely_ghost`.
- **Market-universal noise doesn't count.** A missing salary is so common
  (~100% of listings in some segments) that scoring it would put nearly every
  job in a warning tier. We still *record* the flag, but it never affects the
  tier.

## Signals

| Signal | Kind | Weight |
|---|---|---|
| Job description is a stub | intrinsic | 2 |
| Sparse job description | intrinsic | 1 |
| Generic job title (bare "Manager", "Analyst"…) | intrinsic | 1 |
| Open for an unusually long time (60+ days) | temporal | 2 |
| Opened and closed very quickly (≤ 4 days) | temporal | 2 |
| Listing went stale / disappeared | temporal | 1 |

Tiers: weight ≥ 3 → `likely_ghost`, ≥ 1 → `some_flags`, 0 → `clean`.

The temporal signals are what make source-level watching matter: because
SearchSteward observes each listing on the employer's own career page day
after day, it knows *when a job first appeared* and *how it left* — data an
aggregator scrape can't give you.

## Usage

```python
from ghost_signal import combine, evaluate_intrinsic, evaluate_temporal

intrinsic = evaluate_intrinsic(job_row, scoring_result)   # persisted once per listing
temporal = evaluate_temporal(job_row)                     # derived fresh at read time
signal = combine(intrinsic, temporal)
# GhostSignal(tier="some_flags", reasons=[{"code": "open_too_long", "label": ...}])
```

## Run the tests

```bash
pytest test_ghost_signal.py
```

## License

MIT.
