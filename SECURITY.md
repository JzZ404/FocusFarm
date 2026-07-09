# Security Review – FocusFarm MVP

_Date: 2026-05-25_

## Scope

Static analysis of the FocusFarm codebase for leaked secrets, unsafe client-side storage patterns, content-injection risks, and dependency hygiene.

---

## Findings

### ✅ No secrets or API keys in source code

Grep across all tracked files (`git grep -r "key\|secret\|token\|password\|api"`) found **zero hardcoded credentials**. All external resource URLs (MediaPipe WASM, Google model) are public CDN endpoints that require no authentication.

### ✅ .env handling

- `.env.example` is committed and documents every recognized variable.
- `.gitignore` contains `.env*` and `.env.local`, so real secrets will never be committed accidentally.
- The MVP requires **no environment variables at runtime** — there is nothing secret to leak.

### ✅ Client-side only storage

All persistence uses `localStorage` under the key prefix `focusfarm:*`. There is no backend, no database, and no network request that carries user data. The only outbound fetches are:

| Destination | What is sent | Risk |
|---|---|---|
| `cdn.jsdelivr.net` (MediaPipe WASM) | Nothing — static file download | None |
| `storage.googleapis.com` (MediaPipe model) | Nothing — static file download | None |

No PII leaves the browser.

### ✅ No `console.warn` / debug output in production

`lib/storage.ts` gates its localStorage-error warning behind `process.env.NODE_ENV !== "production"`, so production builds are clean.

### ✅ Input validation

All farm tile placements go through `isValidPosition` which enforces grid bounds and occupation checks before any state mutation — no arbitrary memory writes are possible.

### ✅ No use of `eval`, `dangerouslySetInnerHTML`, or dynamic script injection

Searched entire codebase — none found. MediaPipe is loaded via a standard `<script>` CDN tag (or dynamic import), not via string evaluation.

### ⚠️ Note: localStorage is not encrypted

`localStorage` content is readable by any JavaScript executing on the same origin. This is acceptable for the MVP (the data stored — coins, session times, farm layout — is non-sensitive), but should be revisited if authentication or health data is added.

### ⚠️ Note: No rate-limiting on coin earning

The coin award logic (`calculateReward`) runs entirely client-side. A user could manually call it via the browser console to inflate their balance. This is acceptable for a single-player learning tool with no real-money implications.

---

## Recommendations for future sprints

1. If a backend is added, move coin accounting server-side with signed session tokens.
2. If user accounts are introduced, add a `Content-Security-Policy` header via `next.config.js` to restrict script sources.
3. Consider adding [Dependabot](https://docs.github.com/en/code-security/dependabot) alerts on the repo for automated dependency patching.

---

## Audit conclusion

**No security issues requiring immediate action were found.** The codebase is appropriate for a client-only MVP.
