from datetime import datetime, timedelta, timezone

from ghost_signal import GhostSignal, combine, evaluate_intrinsic, evaluate_temporal


def _intrinsic(**over):
    base = {"stub_jd": False, "sparse_jd": False, "no_salary": False, "generic_title": False}
    base.update(over)
    return base


def _temporal(**over):
    base = {"has_first_seen": True, "open_too_long": False,
            "opened_closed_fast": False, "went_stale": False}
    base.update(over)
    return base


def test_no_flags_is_clean():
    sig = combine(_intrinsic(), _temporal())
    assert isinstance(sig, GhostSignal)
    assert sig.tier == "clean"
    assert sig.reasons == []


def test_unknown_when_intrinsic_missing():
    assert combine(None, _temporal()).tier == "unknown"


def test_unknown_when_no_first_seen():
    assert combine(_intrinsic(), _temporal(has_first_seen=False)).tier == "unknown"


def test_single_weak_flag_is_some_flags():
    sig = combine(_intrinsic(sparse_jd=True), _temporal())
    assert sig.tier == "some_flags"
    assert [r["code"] for r in sig.reasons] == ["sparse_jd"]
    assert sig.reasons[0]["label"] == "Sparse job description"


def test_no_salary_alone_is_clean():
    # no_salary is market-universal noise — it must NOT trip a tier on its own,
    # and must not appear as a ghost reason even though it's still persisted.
    sig = combine(_intrinsic(no_salary=True), _temporal())
    assert sig.tier == "clean"
    assert sig.reasons == []


def test_no_salary_does_not_count_in_combos():
    # sparse_jd alone -> some_flags; adding no_salary changes nothing.
    sig = combine(_intrinsic(sparse_jd=True, no_salary=True), _temporal())
    assert sig.tier == "some_flags"
    assert {r["code"] for r in sig.reasons} == {"sparse_jd"}


def test_decisive_combo_is_likely_ghost():
    sig = combine(
        _intrinsic(stub_jd=True, no_salary=True),
        _temporal(open_too_long=True),
    )
    assert sig.tier == "likely_ghost"
    codes = {r["code"] for r in sig.reasons}
    assert codes == {"stub_jd", "open_too_long"}  # no_salary excluded


def test_single_strong_flag_is_some_flags_not_ghost():
    assert combine(_intrinsic(stub_jd=True), _temporal()).tier == "some_flags"


class _FakeJDQuality:
    def __init__(self, is_stub=False, is_sparse=False):
        self.is_stub = is_stub
        self.is_sparse = is_sparse


class _FakeResult:
    def __init__(self, **kw):
        self.jd_quality = _FakeJDQuality(**kw)


def test_evaluate_intrinsic_reads_flags():
    job = {"salary_min": None, "salary_max": None, "role": "Manager"}
    flags = evaluate_intrinsic(job, _FakeResult(is_stub=True))
    assert flags["stub_jd"] is True
    assert flags["sparse_jd"] is False
    assert flags["no_salary"] is True
    assert flags["generic_title"] is True


def test_evaluate_intrinsic_salary_present():
    job = {"salary_min": 120000, "salary_max": 160000, "role": "Staff Platform Engineer"}
    flags = evaluate_intrinsic(job, _FakeResult())
    assert flags["no_salary"] is False
    assert flags["generic_title"] is False


def test_evaluate_temporal_open_too_long():
    now = datetime(2026, 6, 4, tzinfo=timezone.utc)
    old = (now - timedelta(days=90)).isoformat()
    job = {"first_seen_at": old, "closed_at": None, "source_lifecycle_status": "active"}
    facts = evaluate_temporal(job, now=now)
    assert facts["has_first_seen"] is True
    assert facts["open_too_long"] is True
    assert facts["opened_closed_fast"] is False
    assert facts["went_stale"] is False


def test_evaluate_temporal_opened_closed_fast():
    now = datetime(2026, 6, 4, tzinfo=timezone.utc)
    seen = (now - timedelta(days=10)).isoformat()
    closed = (now - timedelta(days=8)).isoformat()
    job = {"first_seen_at": seen, "closed_at": closed, "source_lifecycle_status": "closed_stale"}
    facts = evaluate_temporal(job, now=now)
    assert facts["opened_closed_fast"] is True
    assert facts["went_stale"] is True


def test_evaluate_temporal_no_first_seen():
    facts = evaluate_temporal({"first_seen_at": None}, now=datetime.now(timezone.utc))
    assert facts["has_first_seen"] is False
