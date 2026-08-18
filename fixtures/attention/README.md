# Attention detection fixtures

Recorded via `/dev/record` (webcam required, dev-only page). Each file is
`{ label_markers: [{t, label}], frames: [{t, landmarks}] }` — see
`scripts/replay.ts` for the exact shape and `docs/attention-baseline.md` for
what these feed into (`npm run attention:eval`).

Not auto-generated — these are real human recordings, deliberately not
synthetic data, so the replay metrics mean something. Update the fixture
inventory table in `docs/attention-baseline.md` when adding one.
