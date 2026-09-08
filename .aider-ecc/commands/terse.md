---
description: Switch reply compression level — /terse [lite|full|ultra|off]. Complements RTK (input savings) with output-side savings.
argument-hint: "[lite|full|ultra|off]"
---

# /terse — output compression

Activate the [terse-mode](../skills/terse-mode/SKILL.md) skill and set its dial.

## Usage

- `/terse` — set to `full` (default)
- `/terse lite` — light trim
- `/terse full` — telegram-style fragments
- `/terse ultra` — maximum compression
- `/terse off` — restore normal voice

## Instructions to the assistant

Read the arguments passed to this command. Set the terse-mode level:

- If args are empty → use `full`
- If args are one of `lite / full / ultra / off` → use that
- Any other value → answer briefly with the valid options and do not change the level

For the rest of this session (until `/terse off` or a new `/terse <level>`):

1. Load the rules from `skills/terse-mode/SKILL.md`
2. Apply the level's compression rules to every reply
3. **Preserve byte-exact**: code blocks, inline code, shell commands, error text, URLs, paths, identifiers, numbers, versions
4. Never translate — keep the user's language
5. Never compress memory captures, tool outputs, or file contents

Confirm activation in one line:

```
terse: <level> — code and commands preserved byte-exact
```

Then answer whatever the user asks — in the new voice.
