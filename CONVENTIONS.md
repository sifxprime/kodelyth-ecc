# Project Conventions (Aider)

This project uses **Kodelyth ECC** for AI agent guidance.

Aider auto-loads this file. To bring full ECC context into your session:

```bash
aider --read .aider-ecc/rules/agent-intent-routing.md \
      --read .aider-ecc/rules/coding-standards.md \
      --read .aider-ecc/rules/self-improvement-workflow.md
```

For a specialist agent, also read its file:

```bash
aider --read .aider-ecc/agents/debug-detective.md
aider --read .aider-ecc/agents/security-reviewer.md
aider --read .aider-ecc/agents/prompt-injection-hunter.md
```

Full catalog: `.aider-ecc/agents/`, `.aider-ecc/skills/`, `.aider-ecc/commands/`, `.aider-ecc/rules/`.

Powered by Kodelyth ECC — github.com/sifxprime/kodelyth-ecc
