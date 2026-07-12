"""Ghost-job likelihood signal — pure, I/O-free decision logic.

A *global* per-listing heuristic, not ground truth. We can never verify a job
was filled or fake, so this module optimizes for transparency (every tier carries
its reasons) and against false-positive harm (absence of evidence -> ``unknown``,
never ``clean``).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional

# Reason code -> (human label, weight). Weight feeds the tier threshold.
#
# NOTE: ``no_salary`` is intentionally NOT a scored ghost reason. Empirically
# ~100% of listings in this market omit salary — a full-corpus sweep put 84% of
# jobs in ``some_flags`` and 0% in ``clean`` purely because no_salary always
# tripped. Missing salary is a comp-transparency concern, not a "this listing is
# fake" tell, so it must not count toward the ghost tier. ``evaluate_intrinsic``
# still computes/persists the ``no_salary`` flag (so it can be re-weighted later
# without a re-seed), but ``combine`` ignores any code absent from this table.
_INTRINSIC_REASONS: Dict[str, tuple] = {
    "stub_jd": ("Job description is a stub", 2),
    "sparse_jd": ("Sparse job description", 1),
    "generic_title": ("Generic job title", 1),
}
_TEMPORAL_REASONS: Dict[str, tuple] = {
    "open_too_long": ("Open for an unusually long time", 2),
    "opened_closed_fast": ("Opened and closed very quickly", 2),
    "went_stale": ("Listing went stale / disappeared", 1),
}
_ALL_REASONS: Dict[str, tuple] = {**_INTRINSIC_REASONS, **_TEMPORAL_REASONS}

# Tier thresholds on summed weight. Conservative: bias toward some_flags/unknown
# over likely_ghost to minimize false positives.
_SOME_FLAGS_MIN_WEIGHT = 1
_LIKELY_GHOST_MIN_WEIGHT = 3

Tier = str  # "clean" | "some_flags" | "likely_ghost" | "unknown"


@dataclass
class GhostSignal:
    tier: Tier
    reasons: List[Dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {"tier": self.tier, "reasons": list(self.reasons)}


def _reasons_from(flags: Dict[str, bool], table: Dict[str, tuple]) -> List[str]:
    return [code for code in table if flags.get(code)]


def combine(
    intrinsic_flags: Optional[Dict[str, bool]],
    temporal_facts: Optional[Dict[str, bool]],
) -> GhostSignal:
    """Combine persisted intrinsic flags + freshly-derived temporal facts.

    Returns ``unknown`` (badge hidden) when we lack enough signal to judge:
      - intrinsic flags not yet seeded (``None``), or
      - no first-seen timestamp (``has_first_seen`` falsy).
    """
    temporal_facts = temporal_facts or {}
    if intrinsic_flags is None or not temporal_facts.get("has_first_seen"):
        return GhostSignal(tier="unknown", reasons=[])

    codes = _reasons_from(intrinsic_flags, _INTRINSIC_REASONS) + _reasons_from(
        temporal_facts, _TEMPORAL_REASONS
    )
    weight = sum(_ALL_REASONS[c][1] for c in codes)

    if weight >= _LIKELY_GHOST_MIN_WEIGHT:
        tier = "likely_ghost"
    elif weight >= _SOME_FLAGS_MIN_WEIGHT:
        tier = "some_flags"
    else:
        tier = "clean"

    reasons = [{"code": c, "label": _ALL_REASONS[c][0]} for c in codes]
    return GhostSignal(tier=tier, reasons=reasons)


# --- constants ---
OPEN_TOO_LONG_DAYS = 60
OPENED_CLOSED_FAST_DAYS = 4

# Titles that are generic on their own (no domain qualifier). Lowercased exact match.
_GENERIC_TITLES = frozenset({
    "manager", "specialist", "coordinator", "analyst", "associate",
    "consultant", "administrator", "representative", "engineer", "developer",
})


def _parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _is_generic_title(title) -> bool:
    if not title:
        return False
    return str(title).strip().lower() in _GENERIC_TITLES


def evaluate_intrinsic(job: Dict, scoring_result) -> Dict[str, bool]:
    """Build the stable intrinsic-flags dict from a job row + V2 scoring result.

    ``job`` keys used: ``salary_min``, ``salary_max``, ``role`` (job title).
    ``scoring_result`` must expose ``.jd_quality.is_stub`` / ``.is_sparse``.
    """
    jd = getattr(scoring_result, "jd_quality", None)
    no_salary = not job.get("salary_min") and not job.get("salary_max")
    return {
        "stub_jd": bool(getattr(jd, "is_stub", False)),
        "sparse_jd": bool(getattr(jd, "is_sparse", False)),
        "no_salary": bool(no_salary),
        "generic_title": _is_generic_title(job.get("role")),
    }


def evaluate_temporal(job: Dict, *, now: Optional[datetime] = None) -> Dict[str, bool]:
    """Derive time-relative facts from a job row's timestamp/lifecycle columns."""
    now = now or datetime.now(timezone.utc)
    first_seen = _parse_dt(job.get("first_seen_at"))
    closed = _parse_dt(job.get("closed_at"))
    status = (job.get("source_lifecycle_status") or "active")

    if first_seen is None:
        return {"has_first_seen": False, "open_too_long": False,
                "opened_closed_fast": False, "went_stale": False}

    went_stale = status == "closed_stale"
    if closed is not None:
        open_span_days = (closed - first_seen).total_seconds() / 86400.0
        opened_closed_fast = 0 <= open_span_days <= OPENED_CLOSED_FAST_DAYS
        open_too_long = False
    else:
        opened_closed_fast = False
        age_days = (now - first_seen).total_seconds() / 86400.0
        open_too_long = status == "active" and age_days >= OPEN_TOO_LONG_DAYS

    return {
        "has_first_seen": True,
        "open_too_long": bool(open_too_long),
        "opened_closed_fast": bool(opened_closed_fast),
        "went_stale": bool(went_stale),
    }
