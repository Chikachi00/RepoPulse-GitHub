# Security Policy

## Supported Version

RepoPulse V1.0 is the supported release line.

## Reporting a Vulnerability

Please report security issues privately to the repository owner. Do not open a public issue for secrets, authentication bypasses, webhook signature bypasses, private repository access leaks or database exposure.

Include:

- affected component
- reproduction steps
- expected and actual behavior
- whether secrets, private repository data or database contents may be exposed

## Security Expectations

- GitHub tokens, installation tokens, private keys and webhook secrets must never be committed.
- Installation tokens are cached only in memory.
- Webhook requests must pass HMAC SHA-256 verification before persistence.
- Private repositories must not fall back to anonymous GitHub API access.
- RepoPulse never executes code from analyzed repositories.
