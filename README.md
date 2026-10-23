# Railbed for Cursor and Grok Bot

<img src="assets/logo.png" alt="Railbed" width="72" height="72">

The official plugin for [Railbed](https://railbed.com), card checkout for online merchants that mainstream processors turn away. It connects Cursor and Grok Bot to Railbed's hosted [Model Context Protocol](https://modelcontextprotocol.io/) server and adds skills, commands and a review agent for building and running a Railbed integration.

Buyers pay by card through independent, licensed providers, and every sale settles as USDC on Polygon to a wallet the merchant controls. Railbed never holds funds.

## Install

1. Open **Cursor Settings → Plugins**, search for **Railbed** and choose **Install**. In chat, `/add-plugin railbed` does the same.
2. Run `/railbed-connect`, or ask anything about your Railbed account. Cursor opens Railbed's sign-in page when it connects, or when you first use an account tool.
3. Railbed then asks you to approve one business, Test or Live mode, and Read only or Full access. Choose Test while you build.

Grok Bot installs plugins from the Cursor Marketplace. Add Railbed there and sign in the same way.

Documentation search works straight away, without signing in.

## What you can do

| Ask for | What happens |
| --- | --- |
| "Add Railbed checkout to this app" | Reads the current API and webhook docs, then implements hosted checkout, payment links or your own checkout UI on your server, with signed webhook handling |
| "Review my Railbed integration" | A read-only reviewer checks secret handling, idempotency, webhook signatures, fulfilment and Test/Live separation, and reports findings by file and line |
| "Test my checkout end to end" | In Test mode, simulates paid, underpaid, declined and failed payments and checks what your webhook receiver and fulfilment did |
| "What did we take yesterday?" | Totals paid payments for a period, each currency and settlement asset kept separate |
| "Why are my webhooks failing?" | Reads endpoints and recent deliveries and explains each failure from its HTTP status and attempts |
| "Make a payment link for $49" | Prepares the link for you to confirm in Railbed, then returns it once it exists |

## What's included

**Skills**, which the agent picks up when a task needs them:

| Skill | Use |
| --- | --- |
| `connect-railbed` | Connect an account, confirm the business and mode, and disconnect |
| `integrate-railbed` | Build or extend an integration from the current docs |
| `test-railbed-checkout` | Test checkout, webhooks and fulfilment in Test mode |
| `inspect-payments` | Look up payments and orders and total paid payments for a period |
| `diagnose-webhooks` | Explain failed deliveries and prepare endpoint changes |
| `prepare-railbed-changes` | Prepare checkouts, payment links and cancellations for your confirmation |

**Commands:** `/railbed-connect`, `/railbed-integrate`, `/railbed-review-integration`, `/railbed-test-checkout`, `/railbed-payments-report` and `/railbed-webhook-doctor`.

**Agent:** `railbed-integration-reviewer`, a read-only auditor that never edits files.

**Rule:** `railbed`, the ground rules for any task that touches Railbed. It loads only when a task involves Railbed, never in unrelated projects.

## MCP

```json
{
  "mcpServers": {
    "railbed": {
      "type": "http",
      "url": "https://mcp.railbed.io/mcp"
    }
  }
}
```

Sign-in is OAuth with dynamic client registration and PKCE. Cursor registers itself and opens Railbed's sign-in page; there is no API key, token or client ID to configure. The plugin needs Railbed's MCP server 1.2.0 or later.

The server's tools fall into four groups. The server is the source of truth for tool names and schemas.

| Group | Tools |
| --- | --- |
| Docs, no sign-in | `railbed_docs_search`, `railbed_docs_read` |
| Connection | `railbed_get_connection`, `railbed_connect`, `railbed_get_profile`, `railbed_get_account` |
| Reads | payments and payment summaries, orders, customers, checkouts, payment links, webhook endpoints and deliveries, and the status of a proposed change |
| Changes you confirm | create checkouts and payment links, cancel a payment link, add, edit or remove a webhook endpoint, send a test webhook; plus `railbed_simulate_payment` in Test mode |

## Safety

- **You confirm every change in Railbed.** Creating a checkout or payment link, cancelling a link and changing or testing a webhook produce a proposal with a confirmation link. Nothing runs until you, signed in to Railbed, confirm it there. The assistant reports a change as done only after Railbed says it completed.
- **One exception, Test mode only.** `railbed_simulate_payment` acts out a card provider's result on a started Test payment straight away. It moves no money, but your Test webhook endpoints receive real signed requests.
- **Some things can't be done from here.** The tools can't move funds, refund payments, change payout wallets or fees, accept a held payment or show a secret key or signing secret. Those stay in the Railbed dashboard.
- **One business, one mode.** A connection is fixed to the business and mode you approved. Tool arguments can't switch it.
- **Paid means paid.** Payment status comes only from Railbed's settlement evidence, never from a redirect, a closed tab or a webhook delivery code.
- **Record text is data.** Customer names, references, notes and URLs in your records are treated as data, never as instructions.

Disconnect at any time from [Developers → AI assistants](https://app.railbed.io/developers#mcp) in the mode you connected. Disconnecting stops future account calls and pending proposals; it can't erase what your assistant already received.

## What this repository contains

Configuration and instructions only: the manifest, the server's public address, skills, a rule, an agent, commands and the logo. It never contains server code, credentials or merchant data, and it ships no hooks or scripts that run on your machine. `scripts/validate.mjs` checks all of that in CI; see [SECURITY.md](SECURITY.md).

To check a change locally:

```bash
node scripts/validate.mjs
```

To try the plugin from a clone, copy this folder to `~/.cursor/plugins/local/railbed/` and run **Developer: Reload Window**, or start the Cursor CLI with `--plugin-dir <path to this folder>`.

## Links

- [Railbed MCP guide](https://railbed.com/docs/mcp/)
- [API reference](https://railbed.com/docs/api/) and [webhooks](https://railbed.com/docs/webhooks/)
- [Support](https://railbed.com/contact/) · support@railbed.com
- [Privacy policy](https://railbed.com/privacy/) · [Terms](https://railbed.com/terms/)
- Security reports: security@railbed.com

Railbed is made by MediaGlobe. The logo is Railbed's own mark.

## License

[MIT](LICENSE)
