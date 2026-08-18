# Attention Detection — Phase Log

Running, human-readable summary of each Build Mandate phase — what
shipped, what was actually found (not just what was planned), and open
caveats. Companion to `docs/attention-baseline.md`, which holds the raw
metrics tables this log summarizes; this file is the narrative, that one
is the data. See the `attention-detection-build-mandate` memory for the
full plan text and phase-by-phase acceptance criteria.

---

## Phase 0 — Observability

**Shipped:** `classifyFrame()` extracted into a pure, testable function
(`lib/attention/classify.ts`) with zero formula changes from what shipped
before it — proven via an independently-written golden-master reference
implementation (later retired once Phase 1 intentionally changed the
behavior it was proving). Dev debug overlay, `/dev/record` fixture
recorder, `scripts/replay.ts`/`scripts/metrics.ts` (`npm run
attention:eval`).

**Real bug caught and fixed:** `RangeError: Invalid string length` on
downloading a long recording — root cause was the recorder capturing
duplicate landmark frames (rAF outrunning the camera's real frame rate)
plus one giant `JSON.stringify()` call hitting V8's string-length ceiling.
Fixed with a per-frame-currentTime dedup guard and building the download
`Blob` from many small string parts instead of one.

**Real baseline recorded:** 2 self-recorded fixtures (~6500 frames each).
90.6% overall accuracy. Notable finding: `phone`-labeled frames, when
correctly caught, were flagged `eyes_closed` 51% of the time rather than a
gaze-based reason — looking down foreshortens eyelids even with eyes open,
confirming a confound the original plan only theorized about.

---

## Phase 1 — Frame-rate independence

**Shipped:** frame-*counter* hysteresis/calibration/EMA smoothing replaced
with elapsed-*time* equivalents, each derived from its frame-counter
predecessor assuming a ~30fps baseline (documented math in
`classify.ts`'s header). Added a stall guard for backgrounded-tab gaps.
Switched both the live detector and recorder from `requestAnimationFrame`
to `requestVideoFrameCallback` (new shared `lib/attention/videoFrameLoop.ts`,
with an `rAF` fallback).

**Result:** essentially unchanged replaying the same 2 fixtures (90.7% vs
90.6%) — the *correct* outcome, since those fixtures run near the 30fps
baseline the new constants were derived from. The actual rate-independence
property was proven by a dedicated new test (same scenario replayed at
simulated 30fps/60fps, transition timestamps compared), not by re-running
the same two fixtures.

**Not verified:** the real `requestVideoFrameCallback` switch itself —
fixture replay never touches the live hook code, only `classifyFrame`.

---

## Phase 2 — Neutral-pose calibration

**Shipped:** ~3s "look at the center of your screen, hold still" onboarding
capture (`useNeutralCalibration`, persisted, re-runnable via a
"Recalibrate" button), an elliptical vertically-asymmetric deadzone
replacing the old single circular radius, and a grid-search fitting
script (`npm run attention:fit`) instead of hand-picked constants.

**Two real findings, not guesses:**
1. First guess at the calibration's "did they hold still enough" sigma
   threshold (0.06) failed on every real recording — measured data showed
   yaw is naturally noisier (~0.08) than pitch/gaze (~0.01-0.03) even
   during genuinely focused behavior. Raised to 0.10 based on the
   measurement.
2. Adding calibration *without* re-fitting the deadzone radii made
   false-distract sharply *worse* (5.3%→21.9%) — caught before shipping.
   A single ~3s calibration snapshot early in a session doesn't track
   postural drift over the rest of it; the fitted radii partly compensate,
   but this is a real, only-partially-solved limitation of one-time
   calibration.

**Process catch:** the first grid search's "winner" landed at the edge of
every one of its 4 search dimensions — recognized as "search range too
narrow," not a real optimum, before trusting it. Widened the grid, re-ran;
final winner lands inside the grid on every axis.

**Result:** overall accuracy 90.7%→91.5%, false-distract and miss rate
both improved on pooled numbers vs. Phase 1 — real but modest, not
dramatic. Also caught that `attention:eval` would've silently gone stale
(not applying calibration, misrepresenting real usage) — fixed to match.

**Not verified:** the live onboarding UI end-to-end in a real browser
(capture feel, retry-loop UX, whether the 0.10 sigma threshold holds up
under a real deliberate "hold still" task vs. the passive-behavior proxy
it was measured against).

**Standing caveat, now load-bearing rather than just noted:** every fitted
number in this phase — sigma threshold, ellipse radii, calibration proxy —
comes from 2 same-person fixtures. Not proven to generalize to a different
face, eye shape, glasses, or camera angle.

---

## Phase 3 — Soft scoring + reward

**Shipped:** continuous `focusScore ∈ [0,1]` (per-dimension soft falloff
for eyes/head/gaze, combined via `min()`) replacing the binary verdict; a
Schmitt trigger (distinct thresholds for focused→distracted vs.
distracted→focused, plus a minimum dwell time between flips) replacing
single-threshold hysteresis; `no_face` given its own longer grace period
before the *binary* state flips (score is always 0 immediately
regardless); `context/SessionContext.tsx` now integrates `focusScore`
every second for coin accrual instead of sampling the binary flag.

**An honest trade-off, not a clean win.** The plan's stated acceptance
criterion — flips/min dropping substantially — was met cleanly on both
fixtures. But binary-state accuracy and seconds-lost/wrongly-credited got
measurably *worse*, worked out by hand to be the direct, expected cost of
adding a threshold gap + dwell time to any Schmitt trigger: real
distractions now need to be more pronounced before counting, and once
something flips, it takes longer to flip back — fewer flips, but each
wrong state (either direction) persists longer. Score-based accounting
(added specifically because the plan's own reward integral made the old
binary-based metrics stop measuring what mattered) is clearly better
calibrated than the binary numbers alone would suggest, but still doesn't
beat Phase 2's own (differently-mechanism'd) binary numbers outright —
reported as-is rather than only citing the comparison that flatters this
phase.

**One regression investigated, not just theorized:** "absent" frames
misread as focused jumped 5%→16%. First guess (flickering face detection
fragmenting the no-face streak) was checked directly against the fixtures
and was wrong — both absence periods are single continuous ~22s+ streaks.
Real cause: the no-face grace period (2000ms) is paid at the start of
*every* streak, and one fixture's second absence event was only ~2.6s
long — up to ~76% of that specific short absence falls inside the grace
window. This is the plan's own specified "don't flip for the first ~2s"
behavior working exactly as designed, now with a concretely measured cost
on short absences — a real tuning consideration for later, not a bug.
**User decision: keep it at 2000ms for now, live-test it, adjust later if
it feels off** — deliberately not further tuned against 2 fixtures alone.

**Re-fit attempted as a same-day follow-up, and rejected.** Re-ran the
Phase 2 fitting script unmodified against the Phase 3 classifier: no
radii combination keeps miss rate under the plan's 15% ceiling at all —
the Schmitt trigger's threshold gap raises the achievable miss-rate floor
independent of radii choice, confirmed by checking even circular-default
radii sit at 18.8%. With the ceiling unmeetable, the fallback search for
lowest-false-distract-anywhere converged on a grid-edge value
(`gazeWeightK=0.1`, the minimum searched) reporting a suspicious 0.0%
false-distract — recognized as a degenerate optimum (near-zero gaze
weight trivially "wins" by making the classifier nearly blind to gaze-
based distraction) per this project's own edge-result discipline, not
accepted. Currently shipped config (4.6% falseDistract, 18.6% missRate)
left unchanged — nothing the grid found honestly beats it. Real fix needs
a different objective function than the ceiling-constrained one Phase 2
used, which stops making sense once the ceiling can't be met — genuine
design work, correctly deferred rather than rushed.

**Incidental fix, unrelated to the plan's ask:** `SessionContext.tsx`'s
reward timer used to re-create its `setInterval` on every single
focused/distracted flip, which could disrupt its actual 1-second cadence
during flicker. Fixed as a side effect of switching to imperative score
reads.

**Not verified:** the live reward integration in a real browser session —
whether coin accrual visibly *feels* smoother through a real blink, and
whether the incidental timer-cadence fix matters in practice.

## Post-Phase-3 live testing (2026-08-18)

First real browser test of the whole Phase 1-3 stack (everything before
this had only been verified via fixture replay + unit tests). User's
verdict: noticeably better than before the rebuild.

**One real finding from live use, not from fixture replay:** looking at
the left/right edge of a laptop screen sometimes read as `looking_away`,
even while genuinely reading the screen — center of screen always fine.
Diagnosis: `worldDevX = yaw + k·gazeX` just adds head-turn and eye-shift
together, but real gaze *naturally* combines head rotation and eye
rotation toward the same target — that's normal human gaze behavior, not
two independent distraction signals. Coordinated movement toward an edge
stacks up faster than either alone, crossing the deadzone boundary before
the person has actually looked away.

**Fix applied:** widened `worldDeviationRX` 0.65→1.0 (`classify.ts`).
Deliberately changed only this one constant, not `gazeWeightK` too (also
a plausible lever for the same root cause — reduce how much the eye term
adds on top of head rotation) — moving one variable at a time so a
re-test can actually attribute what helped. Not a fixture re-fit (the 2
recorded fixtures apparently don't cover much genuine edge-of-screen
viewing); a live-feedback-driven interim value. Re-running
`attention:eval` against the existing fixtures shows the expected
trade-off, not a free win: false-distract improved on one fixture
(2.7%→0.8%), miss rate got worse on the other (28.4%→31.7%) — directionally
correct per the plan's stated priority (false-distract worse than missing
a distraction), but a real cost, not nothing. Awaiting live re-test.
Added `worldDevX`/`worldDevY` to the debug overlay while at it, so the
next live-tuning round has real numbers instead of a guess.

**Confirmed fixed by user re-test (2026-08-18): edge-of-screen viewing no
longer reads as looking_away.** `worldDeviationRX: 1.0` stays as shipped.

**Item (e) — keyboard-vs-phone dwell tolerance (user's idea) — built,
live-tuned twice, then reverted after A/B comparison.** Both behaviors
are geometrically identical to this classifier (gaze pointed down); only
sustained duration tells them apart. Added `gazeDownSinceMs`/
`lookingDownGraceMs`: the downward component of gaze deviation was fully
forgiven (zeroed for gazeScore's distance calculation) below the grace
period, full effect after. Sideways deviation was never forgiven by this —
a phone held off to the side while looking down still counted via the X
component (tested explicitly). 4 new unit tests isolated the mechanism
directly.

Live-tuning history: started at 10000ms (the user's own stated keyboard-
glance ceiling) — reported "too long." Cut to 5000ms — still "too long."
Stopped guessing, asked directly: user's actual glance duration is ~2s.
Set to 3000ms (a small buffer above that). User then asked to A/B compare
with the feature off entirely (toggled via `lookingDownGraceMs: 0`,
mathematically equivalent to the mechanism not existing) — **and preferred
the version without it.** Fully reverted (not left as a disabled config
flag) — `git log` on `attention-phase4-keyboard-iris` still has the whole
experiment (commits `b05ada4`, `bfcc9d3`, `f3d8340`) if ever revisited.

Lesson: this item never had fixture data to validate against, only live
feel — and live feel, iterated on quickly, converged on "don't want this"
rather than "needs a different number." Worth remembering before building
another duration-based tolerance purely from a stated estimate without a
recorded fixture to check it against.

**Item (a) — iris-diameter-normalized eye-openness — tested, NOT
promoted.** Built `computeIrisNormalizedOpenness()` (vertical eyelid gap
÷ iris diameter instead of ÷ eye width) and a comparison script
(`npm run attention:compare-eyes`) that calibrates both signals the same
way against the real fixtures and compares them on `eyes_closed` (real
closure) and `focused` (real openness) specifically — chosen because
today's earlier investigation found `phone`-labeled closure reads likely
reflect genuine squinting, not classifier error, so that label isn't a
clean test of which raw signal is more accurate. Result: closedRecall
essentially identical (98.3%→98.2%, 98.6%→98.6%), false-positive rate
marginally better on one fixture (16.9%→15.5%), barely different on the
other (10.7%→10.6%). Not a clear win — per the plan's own bar ("promote
only if it beats calibrated EAR"), this doesn't clear it. **EAR stays as
the live signal.** The function exists, tested, and unused — available if
a future re-test with more data changes the picture.

**Both changes committed on a dedicated branch
(`attention-phase4-keyboard-iris`)**, off a `main` checkpoint commit
(`5a536b9`) taken specifically so this work could be reverted cleanly if
it didn't pan out — see the build-mandate memory for the full checkpoint
rationale.

## Phase 4 — Revisit signals (started 2026-08-18)

Plan: iris-diameter-normalized eye-openness as a shadow signal; decouple
blink detection from pitch (the phone→eyes_closed confound Phase 0 found);
retry blendshapes as a logged-but-not-verdict-driving signal with a
polarity unit test *before* anything else; optional 4-corner calibration +
regression to predicted screen position if the above aren't enough. Also
where the user's two logged-but-unbuilt observations belong: dwell-time-
based distinction between "glancing at keyboard while typing" and
"staring at phone," and a face-size/distance proxy for "detected but too
far from the camera to be at the desk." Also where re-fitting Phase 2's
geometry against the new Phase 3 mechanism (see above) would fit, if
still relevant by then.

**Item (b), "decouple blink from pitch" — investigated, hypothesis
refuted by real data, no fix made.** Before implementing anything,
measured the actual EAR-vs-pitch relationship in the real fixtures. A
naive open-eyes-only regression showed ~zero correlation (R²≈0.008) —
but that check was circular (excluding already-"closed" frames excludes
exactly the borderline cases a foreshortening effect would produce). Redid
it properly: compared `focused` vs. `phone` closed-rate at **matched**
head pitch. At pitch≈0.3, `focused` reads closed 8% of the time,
`phone` reads closed 97% of the time — at the *identical* head angle. If
this were camera-geometry foreshortening from pitch alone, both labels
should look the same at matched pitch; they don't, by a huge margin. So
pitch isn't the cause. Most likely explanation: genuine eyelid
drooping/squinting specifically during phone use (probably driven by how
far down the *eyes* point, not just the head, or a close bright screen) —
a real, correlated signal, not a measurement artifact. **Conclusion:**
Phase 0's original finding (phone catches often attributed to
`eyes_closed`) probably isn't a confound to fix at all — it's the
classifier catching phone use through a legitimate correlated physical
signal. No code change made; would have been fixing a problem that isn't
actually happening the way the plan assumed. Diagnostic scripts were
scratch-only, not committed.
