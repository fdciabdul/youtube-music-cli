# CI Test Failure Investigation & Fix Plan

## Issue Summary

**Failing test**: `AutoUpdateService > should validate version format correctly and reject malformed versions immediately`

**CI run**: https://github.com/involvex/youtube-music-cli/actions/runs/33671115436

**Symptom**: Test timed out after 5000ms on CI (Ubuntu). 200 tests pass, 1 fails.

## Root Cause Analysis

### The Test

```typescript
// tests/auto-update.test.ts
it('should validate version format correctly and reject malformed versions immediately', async () => {
	const service = getAutoUpdateService();
	const result = await service.update('invalid;rm -rf /');
	expect(result.success).toBe(false);
	expect(result.message).toContain('Invalid target version format');
});
```

### The Code Path

In `source/services/config/auto-update.service.ts`, the `update()` method validates the target version:

```typescript
async update(targetVersion?: string, options?: ...): Promise<UpdateResult> {
    const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
    if (targetVersion && !semverRegex.test(targetVersion)) {
        return {
            success: false,
            channel: this.detectChannel(),   // ← PROBLEM IS HERE (line 97)
            currentVersion: APP_VERSION,
            targetVersion,
            message: `Invalid target version format: ${targetVersion}`,
        };
    }
    // ... rest of method (network fetch, actual update logic)
}
```

### Why It Times Out on CI

1. The input `'invalid;rm -rf /'` does NOT match the semver regex, so the early-return at line 94 is triggered.
2. The early return calls `this.detectChannel()` (line 97), which is also part of the normal flow.
3. `detectChannel()` calls `execSync('npm root -g')` (line 57) — a **synchronous** subprocess spawn.
4. On the CI Ubuntu runner, npm startup takes ~5 seconds (cold start of Node.js + npm on a fresh VM), exceeding bun:test's default 5000ms timeout.
5. Locally on Windows, `npm root -g` takes ~0.45s, so the test completes in ~886ms.

### Timing Evidence

| Environment     | Test Duration       | `npm root -g` Duration |
| --------------- | ------------------- | ---------------------- |
| Local (Windows) | 886ms               | ~450ms                 |
| CI (Ubuntu)     | 5002.52ms (timeout) | ~5000ms (estimated)    |

### Key Observation

The test name says **"reject malformed versions immediately"** — the clear intent is that version validation should be an immediate, side-effect-free check. But the current code calls `detectChannel()` (which does expensive subprocess spawns) even in the validation error path.

## Fix Plan

### Fix 1 (Primary): Stop calling `detectChannel()` in the validation error path

**File**: `source/services/config/auto-update.service.ts`

**Change**: In the early validation error return (lines 94–101), replace `channel: this.detectChannel()` with `channel: 'unknown'`.

**Rationale**:

- When the version is invalid, the channel information is irrelevant — we're rejecting the input before any installation attempt.
- `'unknown'` is already a valid `InstallChannel` type value.
- This makes validation truly "immediate" as the test expects.
- No behavior change for production code: `cli.tsx:648` calls `detectChannel()` separately BEFORE `update()`, so the CLI already has the channel before this code path runs.

**Before**:

```typescript
if (targetVersion && !semverRegex.test(targetVersion)) {
	return {
		success: false,
		channel: this.detectChannel(),
		currentVersion: APP_VERSION,
		targetVersion,
		message: `Invalid target version format: ${targetVersion}`,
	};
}
```

**After**:

```typescript
if (targetVersion && !semverRegex.test(targetVersion)) {
	return {
		success: false,
		channel: 'unknown',
		currentVersion: APP_VERSION,
		targetVersion,
		message: `Invalid target version format: ${targetVersion}`,
	};
}
```

### Fix 2 (Defensive): Add timeout to `execSync` calls in `detectChannel()`

**File**: `source/services/config/auto-update.service.ts`

**Change**: Add `{ timeout: 2000 }` to both `execSync` calls in `detectChannel()` (lines 57 and 74).

**Rationale**:

- Even though `detectChannel()` is no longer called in the validation error path, it's still called in the main update flow (line 106) and in `cli.tsx:648`.
- On slow CI environments, `execSync` without a timeout can hang indefinitely.
- A 2-second timeout is sufficient for `npm root -g` and `brew --prefix` to fail fast (ENOENT or timeout error) rather than blocking.
- The existing `try/catch` blocks already handle errors from these commands, so timeout errors will be caught and treated as "not found".

### Fix 3: No test changes required

The test itself is correct. The test asserts that:

1. `result.success` is `false` ✓
2. `result.message` contains `'Invalid target version format'` ✓

Neither assertion checks `result.channel`, so returning `'unknown'` won't break the test. The test correctly expects "immediate" rejection — the code just wasn't living up to that contract.

## Verification Steps

1. Run the specific failing test locally:

   ```bash
   bun test tests/auto-update.test.ts
   ```

   Expected: 1 pass, completes in <500ms

2. Run the full test suite:

   ```bash
   bun test
   ```

   Expected: 201 pass, 0 fail

3. Run prebuild checks:

   ```bash
   bun run format:check && bun run lint && bun run typecheck
   ```

4. Verify the diff makes sense:
   ```bash
   git diff
   ```

## Risk Assessment

| Risk                              | Likelihood | Mitigation                                                                                                    |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Breaking CLI `ymc update` command | Low        | CLI calls `detectChannel()` separately before `update()`, so channel detection still works for valid versions |
| Breaking production update flow   | Low        | The `'unknown'` channel is only returned for invalid versions, which is an error case anyway                  |
| Timeout still too long            | Low        | 2s timeout on `execSync` ensures fast failure even on slow CI                                                 |
| Lint/format issues                | Low        | Will run `bun run lint:fix` and `bun run format` before finalizing                                            |
