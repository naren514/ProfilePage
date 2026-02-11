# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in Aham, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers directly or use [GitHub's private vulnerability reporting](https://github.com/zendizmo/aham/security/advisories/new).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix**: Depending on severity, critical issues will be prioritized

## Security Best Practices for Deployers

- Never commit `.env.local` or any file containing real credentials
- Use strong, unique values for all API keys and secrets
- Keep dependencies up to date (`npm audit`)
- Enable Firebase Authentication authorized domains only for your production URL and localhost
- Regularly rotate your Firebase service account keys and API keys
- Review the Content Security Policy in `next.config.mjs` if you add new external services

## Scope

This policy applies to the Aham codebase. Third-party services (Firebase, Neon, Vercel, Google AI) have their own security policies.
