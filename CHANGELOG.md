# Changelog

## 1.1.0 — 2026-10-30

- The integration skill covers embedded checkout for signed-in users: the embed asks the merchant's server for a session at Continue, and the server makes it from a saved checkout with `POST /v1/checkout_sessions`. It points the agent at the existing-app guide.
- Server 1.3.0 returns each checkout's `slug`, the value that request takes as `checkout`.
- The manifest's `repository` names the renamed public repository, `Railbed/railbed-cursor-plugin`.

## 1.0.0 — 2026-10-22

- First release for Cursor and Grok Bot.
- Connects to Railbed's hosted MCP server at `https://mcp.railbed.io/mcp` (server 1.2.0 or later) with OAuth sign-in.
- Skills for connecting an account, building an integration, testing checkout in Test mode, inspecting payments, diagnosing webhooks and preparing browser-confirmed changes.
- A Railbed rule, a read-only integration reviewer agent and slash commands for the common workflows.
