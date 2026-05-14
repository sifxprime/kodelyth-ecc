---
name: smart-debug
description: Systematic debugging methodology — powered by Kodelyth. A step-by-step framework to diagnose any bug confidently across any language or framework. Prevents guess-and-check debugging, traces errors to their root cause, and produces a fix backed by evidence.
origin: Kodelyth
---

# Smart Debug — Systematic Debugging Methodology

A structured approach to debugging that works for any language, framework, or error type. Powered by Kodelyth.

## When to Use

- You have a bug that isn't obviously caused by the last change you made
- You've tried a fix and it didn't work (or broke something else)
- The error message is cryptic or misleading
- The bug is intermittent or environment-specific
- You're not sure where in the codebase the problem originates

## How It Works

Smart Debug applies the same process a seasoned senior engineer uses — but makes it explicit and repeatable. The core idea: **symptoms are not root causes**. Every step narrows the search space until you know exactly why the bug exists.

## The 5-Step Framework

### Step 1 — Characterize the Bug

Before touching any code, answer these questions:

```
1. What is the exact error message or symptom? (copy it verbatim)
2. Is it consistent or intermittent?
3. What triggers it? (specific action, data input, timing, environment)
4. When did it start? (after a code change, deployment, dependency update?)
5. Where does it appear? (local only, staging, prod, specific browser/OS?)
```

This step alone eliminates 30% of debugging time by ruling out non-issues.

### Step 2 — Read the Error, Not Just the Message

Error messages have structure. Parse them:

```
[Error Type]: [Message]
  at [function] ([file]:[line]:[column])
  at [caller] ([file]:[line]:[column])
  ...
```

**Read from the bottom of the stack trace up.** The bottom is the root call; the top is where it crashed.

Find the **first line that references your own code** — that is your entry point.

```bash
# Common error classifications:
TypeError           → wrong type passed, null/undefined accessed
ReferenceError      → variable not defined or out of scope
SyntaxError         → code can't be parsed (often a typo or missing bracket)
RangeError          → value out of allowed range (infinite recursion, etc.)
NetworkError / 4xx  → bad request — check what you're sending
NetworkError / 5xx  → server crash — check server logs
CORS Error          → origin policy mismatch — check headers
Promise rejection   → async error not caught — check the chain above
```

### Step 3 — Form ONE Hypothesis

Before running any code, state a hypothesis:

```
Hypothesis: The bug happens because [specific, technical reason].
Evidence for this: [what in the code or logs suggests this].
How to test: [what I will check or change to confirm/deny].
```

Only work one hypothesis at a time. If your test disproves it, form a new hypothesis — do not patch and pray.

### Step 4 — Gather Evidence

Check each source of truth in order:

**A. The error site**
```bash
# Read 30 lines around the crash location
# Understand what data was expected vs what arrived
```

**B. Recent changes**
```bash
git log --oneline -10 -- path/to/affected/file
git diff HEAD~3 -- path/to/affected/file
```

**C. Data flowing in**
```bash
# Add a temporary log just before the crash
console.log('DEBUG value at crash point:', variableName)
# What does it actually contain vs what you expected?
```

**D. All callers**
```bash
grep -rn "functionName\|ClassName" src/
# Is anyone calling this incorrectly?
```

**E. Dependencies / environment**
```bash
# Has a package version changed?
git diff HEAD~10 package-lock.json | grep '"version"'

# Is an env variable missing?
echo $MY_VARIABLE
```

### Step 5 — Fix and Verify

Once you've confirmed the root cause:

1. **Make the minimal fix** — change only what's needed to address the root cause
2. **Explain why it works** — if you can't explain it, you don't understand it yet
3. **Test the fix** — reproduce the original symptom, confirm it's gone
4. **Test adjacent behavior** — did the fix break anything nearby?
5. **Add a regression test** — so this bug can never silently return

```typescript
// Before fix (document what was wrong)
// BUG: user.profile could be undefined when user is a guest account
const name = user.profile.name  // crashes for guest users

// After fix (document why this is correct)
// FIXED: optional chaining handles guest accounts (profile is null for guests)
const name = user.profile?.name ?? 'Guest'
```

## Language-Specific Debugging Tips

### TypeScript / JavaScript

```typescript
// Check for undefined at runtime even when types say it's safe
console.log(typeof value, value)

// Trace async errors to their source
async function riskyOp() {
  try {
    return await fetch(url)
  } catch (e) {
    console.error('[riskyOp] failed:', e.message, { url })
    throw e  // re-throw so caller knows it failed
  }
}

// Find stale closure bugs
useEffect(() => {
  console.log('effect ran with:', { count, userId }) // log deps
}, [count, userId])
```

### Python

```python
# Print full traceback, not just the last line
import traceback
try:
    risky_call()
except Exception as e:
    traceback.print_exc()

# Check types at runtime
print(type(value), repr(value))

# Isolate in a REPL
python3 -c "from module import func; print(func(test_input))"
```

### Go

```go
// Always check error values
result, err := someOperation()
if err != nil {
    log.Printf("someOperation failed: %v (input: %+v)", err, input)
    return nil, fmt.Errorf("someOperation: %w", err)
}

// Use fmt.Sprintf for complex struct inspection
fmt.Printf("value: %+v\n", myStruct)
```

### SQL / Database

```sql
-- Run the query manually with the exact values from the bug
-- EXPLAIN ANALYZE to see query plan
EXPLAIN ANALYZE SELECT * FROM users WHERE id = 123;

-- Check for NULL propagation
SELECT COALESCE(column_name, 'DEFAULT') FROM table;

-- Check constraint violations
SELECT * FROM pg_constraint WHERE conname = 'constraint_name';
```

## Common Root Causes by Symptom

| Symptom | Most likely root cause |
|---|---|
| Works locally, fails in prod | Missing env variable, different data, different dependency version |
| Works first time, fails after | State mutation, missing cleanup, memory leak |
| Fails only for specific users | Permission issue, data-specific edge case, locale/timezone |
| Intermittent failure | Race condition, network timeout, cache miss |
| Broke after a "safe" refactor | Changed behavior, not just structure — test coverage gap |
| Type error on a "correct" type | Async data not yet loaded, API response shape changed |
| Infinite loop / stack overflow | Circular dependency, missing base case, recursive state update |

## Red Flags That Mean You Haven't Found the Root Cause

- Your fix is "just try X and see"
- You changed multiple things at once
- You can't explain *why* the fix works
- The bug appears to be "gone" but you're not sure how
- You're patching the symptom (e.g., `|| ''`) without understanding why the value was missing

If any of these apply, go back to Step 3.

## Rubber Duck Checklist

When you're stuck, explain the bug out loud (or in writing) as if to someone with no context:

1. What should happen?
2. What actually happens?
3. At what exact point does reality diverge from expectation?
4. What is the data state at that point?
5. What code runs between "expected" and "actual"?

The act of articulating the problem often reveals the solution.

---

> Powered by Kodelyth — trace first, fix second, never guess.
