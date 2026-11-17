# Changelog

## 1.3.0 — 2026-11-17

- The integration skill starts from the tested recipe for the project's stack and the playbook at checkouts.md, instead of a blank page, and ends with the Test proof.
- Keys without pasting: where it can run commands, the agent gets the app's secret key and webhook signing secret with `npx checkouts.md login` and `npx checkouts.md webhook`, after one approval in the person's browser.
- The webhook skill no longer carries a dated note about older endpoints; it says to check an endpoint's `events`.
- Server 1.7.0 ranks documentation search by the question's words, describes every tool parameter and points integration work at the docs tools and recipes in its instructions.

## 1.2.0 — 2026-11-07

- Payment links can be paid for 1 to 365 days (7 by default) and can choose their card providers with `routing`; left out, the payer chooses from every provider the business offers.
- Prices can also be in Indian rupees (`INR`) and Swedish kronor (`SEK`).
- The payments skill reports what reached the wallet in US dollars, whatever the coin (`merchant_received_usd`, and `received_usd` in period totals).
- The integration skill points the agent at the OpenAPI document for exact `/v1` schemas.
- Needs server 1.5.0.

## 1.1.0 — 2026-10-30

- The integration skill covers embedded checkout for signed-in users: the embed asks the merchant's server for a session at Continue, and the server makes it from a saved checkout with `POST /v1/checkout_sessions`. It points the agent at the existing-app guide.
- Server 1.3.0 returns each checkout's `slug`, the value that request takes as `checkout`.
- The manifest's `repository` names the renamed public repository, `Railbed/railbed-cursor-plugin`.

## 1.0.0 — 2026-10-22

- First release for Cursor and Grok Bot.
- Connects to Railbed's hosted MCP server at `https://mcp.railbed.io/mcp` (server 1.2.0 or later) with OAuth sign-in.
- Skills for connecting an account, building an integration, testing checkout in Test mode, inspecting payments, diagnosing webhooks and preparing browser-confirmed changes.
- A Railbed rule, a read-only integration reviewer agent and slash commands for the common workflows.
