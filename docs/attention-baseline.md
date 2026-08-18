# Attention Detection — Phase 0 Baseline

Every later phase (1-4) of the attention-detection Build Mandate reports its
`npm run attention:eval` numbers as a **delta against this file**, not in
isolation. See the memory file `attention-detection-build-mandate` for the
full plan.

## Status: real baseline recorded

- **`classifyFrame` is pure and unit-tested** — `__tests__/attention/classify.test.ts`
  (eyes-closed polarity, roll compensation, calibration convergence, blink-
  resistant calibration).
- **Golden-master proof the refactor changed nothing** — `__tests__/attention/golden.test.ts`.
- **Real fixture data recorded and evaluated** — 2 recordings, same person
  (see inventory below). `npm run attention:eval` output as of this commit:

```
(excluding frames within 1000ms of any label transition — see LABEL_BOUNDARY_TRIM_MS)

Per-fixture:
                                file  frames  labeled  accuracy  falseDistract  missRate  flips/min  secLost  secWrongCredit
attention-fixture-2026-08-17T23-17-14-394Z.json    6472     6065     94.4%           5.3%      6.5%       5.21      3.8             7.5
attention-fixture-2026-08-17T23-24-18-506Z.json    6539     6241     87.0%           5.4%     23.5%       5.80      3.8            23.3

By ground-truth label (aggregate across all fixtures):
label           frames  % classified focused  top reason when distracted
focused           4231                 94.6%  looking_away (5%)
phone             2849                 18.8%  eyes_closed (51%)
looking_away      2291                 11.6%  head_extreme (49%)
eyes_closed       1420                  3.2%  eyes_closed (96%)
absent            1515                  5.1%  no_face (93%)

Aggregate:
  fixtures: 2
  total labeled frames: 12306
  overall accuracy: 90.6%
  total seconds lost (focused misread as distracted): 7.6s
  total seconds wrongly credited (non-focused misread as focused): 30.8s
```

## How to read this table

- **accuracy** — % of labeled frames where the verdict matched what the
  label implies (`focused` → expects `isFocused === true`; every other
  label → expects `isFocused === false`).
- **falseDistract** — % of `focused`-labeled frames misread as distracted.
  **This is the priority metric** (Build Mandate Phase 3.4): a coin game
  nobody is incentivized to cheat should err toward not punishing a
  genuinely focused user. Currently ~5% on both fixtures — consistent
  between them, a reasonable starting point.
- **missRate** — % of `phone`/`looking_away`-labeled frames misread as
  focused — the blind spot the whole rework exists to close. **This is the
  metric that most needs Phase 2**: 6.5% on fixture 1 but 23.5% on fixture
  2 — the two recordings aren't consistent with each other here, which on
  its own is worth a second look (different lighting/session/how
  deliberately "phone-like" the pose was) before trusting either number too
  literally.
- **flips/min** — focused↔distracted transitions per minute, measured only
  within continuous `focused`-labeled runs (a flip counted across a
  segment boundary, e.g. jumping from the tail of one focused run straight
  to the head of a much-later one, would be meaningless — the metric
  script guards against that explicitly, see `ADJACENCY_GAP_MS` in
  `scripts/metrics.ts`).
- **secLost / secWrongCredit** — the same false-distract/miss numbers
  translated into seconds of coin reward, which is the number that
  actually matters to a user. Wrongly-credited (30.8s total) currently
  dwarfs lost (7.6s) — expected given the miss-rate-vs-false-distract
  asymmetry above, and the more consequential number for Phase 2 to bring
  down given the game currently rewards it.
- **By ground-truth label breakdown** — added after this round's real
  data, because "missRate" alone hid *why* frames were missed. The
  standout finding: when a `phone`-labeled frame is correctly caught as
  distracted, it's flagged `eyes_closed` (51%) far more than
  `looking_away` — looking down foreshortens the eyelids even with eyes
  genuinely open, dropping EAR below threshold. This is exactly Build
  Mandate Phase 4.2's predicted blink/pitch confound, now confirmed with
  real data rather than just theory. `absent` works well (93% of caught
  frames are correctly `no_face`) even defined as "got up and walked
  around the room" rather than a simple lean-out-of-frame.

## Methodology note: label boundary trimming

Frames within **1000ms of any label marker transition** are excluded from
every metric (see `LABEL_BOUNDARY_TRIM_MS` in `scripts/metrics.ts`) — added
after the first real recording surfaced the actual problem: there's
inherent reaction-time lag around pressing the marker key (the person
either starts drifting into the next behavior slightly before pressing it,
or hasn't fully settled into it yet right after), so frames right at a
transition aren't trustworthy ground truth in either direction. This isn't
tuned against anything — it's a reasonable first guess exactly like the
classifier's own constants, and worth revisiting if later fixtures suggest
a different value.

## Fixture inventory

| File | Person | Conditions | Frames |
|---|---|---|---|
| `attention-fixture-2026-08-17T23-17-14-394Z.json` | user (session 1) | focused w/ natural blinking, phone, looking_away, eyes_closed, absent (walked around room) | 6472 |
| `attention-fixture-2026-08-17T23-24-18-506Z.json` | user (session 2) | same behaviors, second take | 6539 |

**Note for Phase 2:** both fixtures are the same person. Constants fitted
only against this dataset are not proven to generalize — that's exactly
what the broader multi-person dataset (varied eye shapes, a glasses
wearer, different camera angles) is for, deferred per the "record yourself
first to validate the harness" decision. Don't skip that step when Phase 2
starts.

## Phase 1 delta: frame-rate independence

Phase 1 replaced frame-*counter* hysteresis/calibration/smoothing
(`framesToDistract: 6`, `framesToRefocus: 4`, `calibrationFrames: 60`, a
fixed `emaAlpha: 0.35`) with elapsed-*time* equivalents
(`msToDistract`, `msToRefocus`, `calibrationMs`, a time-constant
`emaTauMs`), plus a stall guard that resets smoothing/duration timers
across a backgrounded-tab-sized gap (`stallGapMs`). See
`lib/attention/classify.ts`'s header for the full mechanism and the
derivation of each new constant from its frame-counter predecessor. Also
switched both the live detector and the recorder from
`requestAnimationFrame` to `requestVideoFrameCallback` (with an `rAF`
fallback for browsers without it) via the new
`lib/attention/videoFrameLoop.ts`, so detection runs once per real camera
frame instead of once per display repaint.

`npm run attention:eval` against the same two fixtures, unchanged:

```
Per-fixture:
                                file  frames  labeled  accuracy  falseDistract  missRate  flips/min  secLost  secWrongCredit
attention-fixture-2026-08-17T23-17-14-394Z.json    6472     6065     94.4%           5.3%      6.4%       5.21      3.7             7.5
attention-fixture-2026-08-17T23-24-18-506Z.json    6539     6241     87.0%           5.4%     23.6%       5.80      3.8            23.3

Aggregate:
  overall accuracy: 90.7%  (Phase 0: 90.6%)
  total seconds lost: 7.5s  (Phase 0: 7.6s)
  total seconds wrongly credited: 30.8s  (Phase 0: 30.8s)
```

**Essentially unchanged, as expected — this is the correct outcome, not a
coincidence.** The two real fixtures were recorded at close to the ~30fps
baseline the new ms-constants were deliberately derived from, so at that
rate the new duration-based mechanism should reproduce the old
frame-counter mechanism closely. The property Phase 1 actually fixes —
behavior no longer changing when the *rate* changes — isn't visible by
replaying the same two fixtures again; it's covered instead by
`__tests__/attention/frameRateIndependence.test.ts`, which replays a
synthetic scenario at simulated 30fps and 60fps and asserts the resulting
focused/distracted transition timestamps land within a fixed, small,
rate-*independent* tolerance of each other — before Phase 1 this would have
failed, since a frame-counter's flip time was directly proportional to how
often the loop happened to run.

**Not verified by fixture replay (still math-traced, not proven against
real hardware):** the actual `requestVideoFrameCallback` switch in
`useAttention.ts`/`useLandmarkStream.ts` — fixture replay never touches
that code at all (it feeds pre-recorded landmarks straight into
`classifyFrame`), so its correctness rests on the browser-API contract and
`lib/attention/videoFrameLoop.ts`'s own fallback logic, not on anything
`npm run attention:eval` can check. The debug overlay's `loopKind` field
(and `rafHz`/`cameraHz` converging under `"rvfc"`) is the way to confirm
this live once you're testing in a real browser again.

## Phase 2 delta: neutral-pose calibration + elliptical deadzone

Phase 2 added: a ~3s "look at the center of your screen and hold still"
onboarding capture (`lib/attention/neutralCalibration.ts` +
`lib/hooks/useNeutralCalibration.ts`, wired into `app/session/page.tsx`,
persisted via `lib/storage.ts`'s `getAttentionCalibration`/
`saveAttentionCalibration`, re-runnable via a "Recalibrate" button);
`worldDevX`/`worldDevY` (renamed from `worldGazeX`/`worldGazeY`) now
measure deviation from that calibrated neutral pose instead of raw
yaw+gaze from an assumed-zero origin; an explicit `gazeWeightK` instead of
an unstated implicit weight of 1.0 when combining head pose and iris
offset; and an elliptical, vertically-asymmetric deadzone
(`worldDeviationRX`/`RDown`/`RUp`, same treatment for the head-pose-too-
extreme cutoff via `headPoseRX`/`RDown`/`RUp`) replacing the old single-
radius circle. Full mechanism in `lib/attention/classify.ts`'s header.

**Real fixtures predate this phase and never ran an actual onboarding
capture.** Both `scripts/metrics.ts` and `scripts/fitCalibration.ts`
derive a stand-in per-fixture calibration from the first ~3s of each
fixture's first "focused"-labeled segment
(`scripts/deriveNeutralCalibration.ts`) — this is a proxy for the real
thing, not the real thing itself.

**A concrete finding from that derivation, before any fitting happened:**
the first guess at the calibration's reject/retry threshold
(`NEUTRAL_CALIB_MAX_SIGMA`) was 0.06, picked with no data behind it —
measured against these two fixtures, it failed on *both*, every time.
Actual sigmas during natural "focused" behavior: yaw ~0.077-0.086, but
pitch/gazeX/gazeY all under 0.03 — yaw is naturally noisier than the other
axes even when a person believes they're holding still, which a single
guessed threshold didn't anticipate. Raised to 0.10 (see
`neutralCalibration.ts`'s comment for the full reasoning, including why
this is deliberately on the permissive side — natural "focused" behavior
isn't the same as a deliberate "hold still" task, so the real onboarding
capture should measure tighter than this proxy in practice).

**Fitting (`npm run attention:fit`), grid search over
`gazeWeightK`/`worldDeviationRX`/`RDown`/`RUp` against both fixtures
(pooled raw frame counts, not per-fixture percentage averages), optimizing
lowest false-distract rate subject to miss rate ≤15% (the plan's stated
ceiling):**

```
Phase 1 (shipped, uncalibrated, circular default radii):
  falseDistract=5.3% missRate=15.6%

+ neutral-pose calibration only (still circular default radii, k=1):
  falseDistract=21.9% missRate=15.0%

+ fitted ellipse radii (winner, k=1 RX=0.65 RDown=0.2 RUp=0.1):
  falseDistract=4.3% missRate=14.7%
```

**The middle row is the most important one in this table.** Adding
calibration *without* also re-fitting the radii made false-distract
sharply *worse* (5.3%→21.9%), not better. Diagnosis: the two fixtures'
derived neutral pitch differs by a lot (yaw0=-0.303/pitch0=0.190 for
fixture 1, yaw0=-0.122/pitch0=0.271 for fixture 2) — plausibly because a
~3s window sampled once near the start of a multi-minute recording doesn't
capture genuine postural drift across the rest of the session, so
centering on it can push *later* natural variation further from the new
origin than it was from the old uncorrected one. The fitted radii
partly compensate for this (tighter downward/upward tolerance, wider
horizontal), which is exactly why calibration and radii had to be fit
*together*, not calibration alone treated as a free win. This drift-
sensitivity is a real, only-partially-mitigated limitation of a single
one-time calibration — worth keeping in mind for Phase 3/4, not fully
solved here.

**Grid search discipline:** the first grid run's winning value landed at
an edge in all four dimensions — a sign the search range was too narrow,
not a real optimum (flagged in `fitCalibration.ts`'s own comments). Grid
was widened and re-run; the reported winner above lands inside the grid on
all four axes.

**`npm run attention:eval` (now applies each fixture's own derived
calibration by default — see that script's header for why running it
uncalibrated would now silently misrepresent real usage):**

```
Per-fixture:
                                file  frames  labeled  accuracy  falseDistract  missRate  flips/min  secLost  secWrongCredit
attention-fixture-2026-08-17T23-17-14-394Z.json    6472     6065     95.9%           1.9%      5.8%       4.17      1.3             6.9
attention-fixture-2026-08-17T23-24-18-506Z.json    6539     6241     87.1%           6.7%     22.5%       8.70      4.7            22.2

Aggregate:
  overall accuracy: 91.5%  (Phase 1: 90.7%)
  total seconds lost: 6.0s  (Phase 1: 7.5s)
  total seconds wrongly credited: 29.1s  (Phase 1: 30.8s)
```

Note this table's per-fixture rates aren't directly the same numbers as
the pooled fit-script table above — `metrics.ts` reports each fixture's
own percentage and a labeled-frame-weighted aggregate accuracy, while
`fitCalibration.ts` pools raw frame counts across fixtures into one
false-distract/miss rate. Different aggregation conventions, not a
discrepancy; both are internally consistent.

**Net result, both real and modest, not dramatic:** overall accuracy up
0.8pt, false-distract and miss rate both improved on the pooled numbers,
meeting the plan's Phase 2 acceptance criteria ("false-distract rate...
improves materially vs. baseline; miss rate... improves materially vs.
baseline") in direction if not by a huge margin.

**The caveat that matters most, repeated because it's easy to lose track
of:** every number above — the calibration proxy, the sigma threshold, the
fitted radii — comes from **2 same-person fixtures**. None of this is
proven to generalize to a different face, eye shape, glasses, or camera
angle. This isn't a new limitation Phase 2 introduced; it's the same one
flagged since Phase 0, now load-bearing for actual fitted numeric
constants rather than just a replay harness. Recording 2-3 other people
(even one short pass each) before trusting these constants further, or
before Phase 3 builds on top of them, is still the single highest-leverage
thing missing here.

**Not verified by fixture replay, still needs a real browser session:**
the live onboarding UI itself (`CalibrationScreen.tsx`,
`useNeutralCalibration.ts`, the session-flow wiring in
`app/session/page.tsx`) — replay never touches any of that, it only
exercises the pure `classify.ts`/`neutralCalibration.ts` functions. Things
this can't confirm: the 3-second capture actually feels reasonable in
practice, the auto-retry loop's UX when someone can't hold still, whether
`NEUTRAL_CALIB_MAX_SIGMA` at 0.10 is actually easy to pass under a real
deliberate "hold still" instruction (vs. the passive-behavior proxy it was
measured against), and that persistence/recalibration round-trips
correctly through actual localStorage in a real browser.

## Phase 3 delta: soft scoring + Schmitt trigger + reward integral

Phase 3 replaced the binary frameOK decision with a continuous
`focusScore ∈ [0,1]` (`smoothFalloff` per dimension — eyes, head pose,
gaze deviation — combined via `min()`), replaced single-threshold
hysteresis with a Schmitt trigger (distinct `schmittLow`/`schmittHigh`
thresholds plus a `minDwellMs` floor between flips), gave `no_face` its
own longer grace period (`noFaceGraceMs`) before the *binary* state flips
(focusScore is always 0 immediately regardless), and wired
`context/SessionContext.tsx`'s coin accrual to integrate `focusScore`
every second instead of sampling the binary flag. Full mechanism in
`classify.ts`'s header.

**`npm run attention:eval`, same two fixtures, DEFAULT_CONFIG's radii
carried forward unchanged from Phase 2** (this phase doesn't re-fit
geometry — see below):

```
Per-fixture:
                                file  frames  labeled  accuracy  falseDistract  missRate  flips/min  secLost  secWrongCredit  scoreSecLost  scoreSecWrongCredit
attention-fixture-2026-08-17T23-17-14-394Z.json    6472     6065     93.0%           2.7%      7.5%       3.12      1.9            12.1           6.9                  7.0
attention-fixture-2026-08-17T23-24-18-506Z.json    6539     6241     83.5%           6.6%     28.4%       5.80     17.7            29.8           5.4                 22.3

Aggregate:
  overall accuracy: 88.2%  (Phase 2: 91.5%)
  [binary isFocused] seconds lost: 19.6s (Phase 2: 6.0s), wrongly credited: 42.0s (Phase 2: 29.1s)
  [Phase 3 focusScore] seconds lost: 12.3s, wrongly credited: 29.3s
```

**This is a real, honest trade-off — not a clean win, and not hidden.**
The plan's stated acceptance criterion — "flips/min during focused
segments drops substantially" — is met cleanly: 4.17→3.12 and 8.70→5.80
per fixture, both meaningfully lower. But the *binary* accuracy/seconds
numbers got measurably worse, not better, and false-distract/miss rates
moved in mixed directions across the two fixtures. Root cause, worked out
by hand from the math rather than guessed: `schmittLow=0.35` and
`schmittHigh=0.6` are *stricter* effective boundaries than the old single
threshold. `smoothFalloff(d, 0.8, 1.3)` only reaches 0.35 at ellipse
distance ≈1.125 (12.5% further out than the old hard `d=1.0` boundary) —
so a real distraction now has to be more pronounced before the Schmitt
trigger's sustained-streak clock even starts, and once it does flip,
`minDwellMs` (600ms) plus `schmittHigh`'s own stricter bar means it takes
longer to flip back. Fewer flips, but each wrong state — in either
direction — now persists longer once it happens. This is the textbook
cost of adding hysteresis/dwell to any Schmitt trigger, not a bug.

**The `scoreSecLost`/`scoreSecWrongCredit` columns are the metric that
actually matters post-Phase-3** — what reward accrual integrates now,
added to `scripts/metrics.ts` specifically because the pre-existing
binary-based `secLost`/`secWrongCredit` stopped measuring what Phase 3
changed the moment `isFocused` became "UI-display only." Within Phase 3
itself, score-based accounting is clearly better calibrated than what the
now-laggier binary display alone would suggest (12.3s/29.3s vs.
19.6s/42.0s) — but `scoreSecLost` (12.3s) is still worse than Phase 2's
own binary number (6.0s). That's not an apples-to-apples regression (Phase
2 never had a continuous score to compare against), but the real-world
seconds-of-focused-time-misread number did go up in whatever form you
measure it, and that's worth being straight about rather than only citing
the comparison that flatters this phase.

**A specific, investigated regression, not just theorized:** the
"absent" label's %-classified-focused jumped from 5.1% (Phase 2) to
16.1% (Phase 3). First hypothesis — flickering face detection during
absence fragmenting the no-face streak — was checked directly against the
fixtures and was **wrong**: both fixtures' absence periods are single,
continuous ~22s+ no-face streaks, not fragmented. The real mechanism:
one fixture has a second, *shorter* (~2.6s) absence event, and the
`noFaceGraceMs` (2000ms) grace period is paid at the start of *every*
no-face streak — for a streak only marginally longer than the grace
period itself, up to ~76% of that entire absence can fall inside the
window where the binary state is deliberately held rather than flipped.
This is the plan's own specified behavior ("don't flip to distracted for
the first ~2s... leaning out of frame ≠ scrolling Instagram") working
exactly as designed, now with a concretely measured cost on short
absences specifically.

**Decision (user, 2026-08-18): keep `noFaceGraceMs` at 2000ms for now.**
Deliberately not tuned further against these 2 same-person fixtures —
the plan was to live-test it first and adjust based on how it actually
feels to use, not keep grid-searching a single constant against a thin
dataset. If a future session revisits this, that's the context: it's a
live-feel tuning call, not an unresolved bug.

**Follow-up: the re-fit was attempted, and doesn't produce a trustworthy
result — the ceiling-constrained objective itself breaks down under
Phase 3's mechanism.** Re-running `scripts/fitCalibration.ts` unmodified
against the current (Phase 3) classifier found that **no radii
combination in the grid keeps miss rate at or under the plan's 15%
ceiling** — not a radii problem: even the old circular-default radii sit
at 18.8% miss rate before any fitting, because the Schmitt trigger's
threshold gap itself raises the achievable miss-rate floor for this
dataset, independent of what radii you pick (see the delta section above
for why). With the ceiling unattainable, the script's fallback searches
for the single lowest-false-distract candidate in the whole grid instead —
and that search converges on `gazeWeightK=0.1` (the grid's *minimum*, an
edge value), reporting a suspicious-looking 0.0% false-distract. Per this
project's own stated discipline (an edge result signals a search-range
problem, not a real optimum) this was NOT accepted: a near-zero gaze
weight trivially minimizes false-distract by making the classifier nearly
blind to gaze-based distraction, not a genuine improvement. **Currently
shipped `DEFAULT_CONFIG` (4.6% falseDistract, 18.6% missRate, pooled)
was left unchanged** — it's a reasonable, non-degenerate point, and nothing
the grid found beats it honestly. The real fix here isn't re-running the
same search — it's a different objective function (the ceiling-constrained
"minimize false-distract subject to a miss-rate cap" formulation made
sense in Phase 2 but stops being meaningful once the cap can't be met at
all) — genuine future design work, not a quick re-run, correctly deferred
rather than rushed into a bad answer.

**Not verified by fixture replay:** the live reward integration in a real
browser session — `context/SessionContext.tsx`'s 1Hz sampling of
`focusScoreRef`, `SessionTimer.tsx`'s fractional-seconds display, and
whether coin accrual visibly *feels* smoother through a real blink (the
unit test proves brief closures never move `eyeScore` off 1, which is the
mechanism the smoothness claim rests on, but replay can't show what a
session actually looks like end to end). Also incidentally found and
fixed while doing this phase, unrelated to the plan's ask but a real bug:
`SessionContext.tsx`'s reward timer used to re-create its `setInterval`
on every single focused/distracted flip (`isFocused` was in that effect's
dependency array), which could disrupt the timer's actual 1000ms cadence
during a flicker-heavy stretch — removed now that the timer reads
`focusScoreRef` imperatively instead of closing over reactive state.
