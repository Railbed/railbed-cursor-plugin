---
name: integrate-railbed
description: Implement or review a Railbed integration in the person's code, whether hosted checkout sessions, payment links, an own-UI flow with provider hand-off, or a signed webhook receiver with safe fulfilment. Use when the request mentions Railbed checkout, the payments API, webhooks, signing secrets, fulfilment or going live. Works from the public docs, with or without a repository.
---

# Integrate Railbed

## Decide the shape first

Infer it from the request and the code; ask only when it is unclear.

| Shape | The server does | The buyer sees |
|---|---|---|
| Hosted checkout | `POST /v1/checkout_sessions`, then redirect to the session `url` | Railbed's page, then `success_url` |
| Own UI | Create, then `POST /v1/checkout_sessions/:id/start`; show the returned providers | Your screen; the chosen provider's `handoff_url` in a new tab |
| Embedded checkout for signed-in users | A route the embed calls at Continue: `POST /v1/checkout_sessions` with `checkout` (and `plan`, `option` for a pricing table), the user's `reference` and `metadata`, and an `Idempotency-Key`; answer `{ "session": id }` | The checkout in a frame on your page; the provider in a new tab |
| Payment links | `POST /v1/payment_links`, or the dashboard | One page for one payer |
| Webhook receiver | Verify, store the event id, answer 2xx, fulfil in a job | Nothing |

## Start from the tested recipe

With a repository open, do not write the integration from a blank page. `https://checkouts.md/llms.txt` lists a recipe for each stack (Next.js, Express, Cloudflare Workers, Supabase, Laravel, Django, Rails, a static site and the common app builders). Fetch the one that fits and adapt it to the project: each is a complete integration that was run end to end, with prices on the server, the session route, the signed webhook receiver and fulfilment that runs once. For any other stack, or to see every step in order with its commands, error codes and fixes, follow `https://checkouts.md/playbook.md`. If the project has a `CHECKOUTS.md` at its root, read it first: it records how the project already takes money.

## Get the keys without anyone pasting them

The app's server needs a secret key and, for webhooks, a signing secret. The MCP connection is neither, and no tool returns one. When you can run commands in the project:

1. `npx checkouts.md status` says which are already present, without printing them.
2. `npx checkouts.md login` prints a Railbed approval link and a code to match. Give both to the person; once they approve, the keys are written to the project's env files (which it adds to `.gitignore`), never to the terminal or the chat. Hosts that keep secrets elsewhere, such as Vercel, Cloudflare and Supabase, have their own options in the playbook's Connect step.
3. `npx checkouts.md webhook <public https address>` adds the endpoint and saves its signing secret beside the key. `npx checkouts.md test` then makes a simulated Test payment.

Without a terminal, tell the person to create the key and reveal the signing secret in Railbed Developers and to put both in the server's environment themselves.

## Read the current contract

Search with `railbed_docs_search`, then read the matching `page` and `anchor` with `railbed_docs_read`, and cite the returned `url` next to each fact you rely on. The recipe gives the structure; these tools are the authority for every field and error code. Starting pages: `api`, `api/checkout-sessions`, `api/payments`, `guides/hosted-checkout`, `guides/custom-checkout`, `guides/existing-app`, `guides/fulfilment`, `webhooks`, `webhooks/signatures`, `testing`. Every `/v1` request, response and error code is also in the OpenAPI 3.1 document at `https://railbed.com/docs/api/openapi.json`. Follow `next_offset` with the same `content_hash`; if the page changed, start again at offset 0. Do not write an endpoint, header, field or algorithm from memory.

## Rules that do not bend

- The API base is `https://pay.railbed.io/v1`, called from the server with `Authorization: Bearer` and a secret key (`rb_test_…` or `rb_live_…`). The API accepts no browser requests and has no publishable key.
- Refer to the key and the webhook signing secret by environment-variable name (`RAILBED_SECRET_KEY`, `RAILBED_WEBHOOK_SECRET`, or the project's own names). Never print, log, commit or paste their values, and never ask for them.
- Amounts are decimal strings (`"49.00"`) from `1.00` to `100000.00`; currencies are `USD`, `EUR`, `GBP`, `CAD`, `AUD`, `INR` and `SEK`. Save the order, with the `Idempotency-Key` you will send, before calling `POST /v1/checkout_sessions`, and retry a timeout with the same key and body. That create is the only endpoint that uses the header; for payment links, list by `reference` before creating again.
- Fulfil only when the server has seen the payment as `paid` from Railbed: a webhook whose signature you verified, or `GET /v1/payments/:id`. A return to `success_url`, a closed tab or a query parameter is not proof. Before granting, check the payment id saved on the order, `livemode`, `reference` and metadata, and `amount` with `currency`, then record the grant with a unique constraint on the payment id in the same transaction as the delivery. `held` is not paid.
- Verify `Railbed-Signature` on the raw request body: HMAC-SHA256 over `{t}.{raw body}` keyed with the `whsec_…` secret, reject `t` more than five minutes from now, compare each `v1` in constant time and accept when any matches (two values sign for 24 hours after a secret roll). Deduplicate on the event `id`: events arrive at least once and can arrive out of order. Acknowledge unknown event types, and skip sample events (`metadata.sample` is `"true"`) with a 2xx.
- In an own-UI flow, open the `handoff_url` from the buyer's click in a new tab. Never fetch it from the server, frame it or edit its query.
- Keep Test and Live explicit: separate keys, endpoints and secrets per environment. A simulated Test payment proves the integration, not real settlement.
- Railbed cannot refund, transfer funds, accept a held payment or reveal a secret through the API. Do not invent such calls. Refunds are sent from the merchant's own wallet and can be recorded on the order afterwards.

## With a repository

Read the existing checkout, payment and webhook code before editing, and follow the project's conventions. Make the requested change, keep the diff focused, and run the project's tests or a focused check. Then prove it in Test with the `test-railbed-checkout` workflow: a simulated paid payment that fulfils once, an underpaid one that grants nothing, a repeated delivery and a wrong signature. Say what you verified: a typecheck, a unit test, a simulated Test payment and a delivered webhook are different claims.

## Without a repository

Grok Bot and chat sessions often have no code open. Answer from the documentation: give the request and response shapes, a short snippet in the person's language that reads the secret from an environment variable, and the checklist above. Say which steps still have to happen on their server and in Railbed Developers.

## Account reads

If the task needs the business's records (deliveries, a stored payment status), use the `connect-railbed` workflow first. The MCP connection is not an API credential and never replaces a secret key in the integration.
