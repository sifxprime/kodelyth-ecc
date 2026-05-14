# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.8.x   | Yes — current stable |
| 1.7.x   | Yes — security fixes only |
| 1.6.x   | Yes — security fixes only |
| 1.5.x   | No — upgrade to 1.8.x |
| < 1.5   | No — upgrade to 1.8.x |
| < 1.0   | No |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via email:

**sifxprime@kodelyth.com**

Subject line: `[SECURITY] kodelyth-ecc — <short description>`

### What to include

- Description of the vulnerability
- Steps to reproduce (minimal, clear)
- Affected component (agent name, hook, install script, etc.)
- Potential impact
- Your suggested fix (optional but appreciated)

---

## Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Within 14 days for critical issues |
| Public disclosure | After fix is released and users have time to update |

---

## Scope

### In scope

- Secrets or credentials embedded in any file in this repository
- Install scripts (`install.sh`, `install.ps1`) that write malicious content to user machines
- Hooks that could execute arbitrary code without user consent
- Agent definitions that instruct the model to leak sensitive data

### Out of scope

- Vulnerabilities in Claude Code, Google Antigravity, or any AI platform itself
- Social engineering attacks against end users
- Issues that require physical access to the target machine

---

## Security Principles in This Project

Kodelyth ECC follows these security practices:

- No secrets, credentials, or API keys are stored anywhere in this repository
- Install scripts only copy files to known user config directories (`~/.claude/`, `.agent/`)
- Hooks run as PostToolUse/PreToolUse — they never auto-execute shell commands without user awareness
- All hook scripts are plain Node.js with zero external npm dependencies
- MIT license — fully auditable, no obfuscated code

---

## Credits

Responsible disclosure is appreciated. Reporters who identify valid security issues will be credited in the release notes (unless you prefer to remain anonymous).

Built and maintained by **Kodelyth** — [@sifxprime](https://github.com/sifxprime)
