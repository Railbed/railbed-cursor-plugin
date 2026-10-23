# Security

## Reporting a vulnerability

Please don't open a public issue for a security problem. Email security@railbed.com, or follow the policy at https://railbed.com/security/. We reply from the same address.

## What this repository holds

Configuration and instructions only: the plugin manifest, the public address of Railbed's hosted MCP server, skills, a rule, a review agent, slash commands, a README and the logo.

It never holds server code, API keys, webhook signing secrets, OAuth client secrets or other credentials, internal hostnames, or merchant and buyer data. The plugin ships no hooks and no executable code that runs on your machine; `scripts/validate.mjs` runs only in CI and when you run it yourself.

## How access works

Sign-in and permissions live on Railbed's server, not in this plugin:

- Cursor signs in with OAuth (authorization code with PKCE, dynamic client registration). No token or key is stored in these files.
- The signed-in person approves one business, Test or Live mode, and Read only or Full access in Railbed. Tool arguments can't change that choice.
- Every change to a checkout, payment link or webhook is a proposal the person confirms in Railbed's own page. The one exception is simulating a payment on a Test connection, which moves no money.
- The tools can't move funds, refund payments, change payout wallets, accept held payments or reveal secrets.

Disconnect at any time from https://app.railbed.io/developers#mcp.

## Controls

- CI runs `node scripts/validate.mjs` (manifest and component checks, HTTPS-only allowlisted MCP host, no inline credentials, a secret scan) and gitleaks over the full history on every push and pull request.
- Adding a new MCP host to the allowlist needs a security review.
