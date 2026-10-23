---
name: test-railbed-checkout
description: Check a Railbed integration end to end in Test mode with railbed_simulate_payment. Confirm a Test connection with Full access, get a started Test payment, simulate paid, underpaid, declined and failed, and confirm the webhook receiver and fulfilment behaved. Use when the person wants to test checkout, webhooks or fulfilment before going live.
---

# Test a Railbed checkout end to end

`railbed_simulate_payment` acts out what a card provider would do on a started Test payment. It runs at once with no browser confirmation, charges no card and moves no money. It is the one write that does not wait for the person to confirm.

## Preconditions

1. Call `railbed_get_connection`. The connection must be Test mode with Full access. On a Live connection, stop: the tool is refused there, and nothing in this skill applies to real payments. If needed, ask the person to approve a Test connection (see `connect-railbed`).
2. Before the first simulation, tell the person that the business's Test webhook endpoints receive real signed HTTP requests for each outcome. If a Test endpoint feeds a system that emails customers or ships goods, they should point it at a test receiver first; `railbed_list_webhooks` shows the endpoints.
3. Agree what should happen on `paid`, `held`, a decline and a failure, so the result can be judged.

## Get a started Test payment

The payment must have been started: the buyer, or the person's server, entered an email and was given a way to pay. Simulating before that is refused.

- From the person's integration: have them run their checkout in Test, or call `POST /v1/checkout_sessions` and `POST /v1/checkout_sessions/:id/start` from their server with a Test key.
- Without code: prepare a Test payment link with `railbed_create_payment_link` (see `prepare-railbed-changes`), have the person confirm it, then ask the person to open the link and continue with an email. Never open the link or enter an email yourself: that starts a payment. `railbed_list_payments` with `status` `open` or `pending` finds recent payments, and `railbed_get_payment` shows `started_at`.

Use a new payment for each scenario that finishes a payment. A declined outcome keeps the payment open, so it can be retried on the same payment.

## Run the outcomes

Call `railbed_simulate_payment` with `payment_id` and `outcome`:

| Outcome | What Railbed does | Expected on the person's side |
|---|---|---|
| `paid` | About 97% of the value arrives; status `paid`; `payment.paid` sent | Order fulfilled once |
| `underpaid` | Half arrives; status `held`; `payment.held` sent | Nothing fulfilled; the dashboard shows Needs your decision |
| `declined` | Stays open; no failed webhook | Nothing fulfilled; the buyer can choose another provider |
| `failed` | Terminal; `payment.failed` sent | Nothing fulfilled; a new session is needed |

The result is the payment as `railbed_get_payment` returns it. A payment that is already paid, held, failed or expired keeps its result.

## Check what happened

- `railbed_list_webhook_deliveries` for each Test endpoint: event type, HTTP status and attempts for this `payment_id`. A 2xx proves the receiver answered, not that it verified the signature or fulfilled.
- The person's logs or database: one grant per payment, nothing granted for `held`, `declined` or `failed`, and a second delivery of the same event ignored.
- `railbed_get_payment` for the stored status and settlement fields.

Extend the plan when it matters: resend a delivery from the dashboard's delivery log to prove deduplication, send a request with a wrong signature to prove rejection, create two sessions with the same `order.id` to prove one fulfilment per order, or leave a session unpaid to see `payment.expired` after 24 hours.

## Report

List each outcome with the payment id, the stored status, the deliveries observed and whether fulfilment behaved. Keep the claims apart: simulated settlement, a delivered webhook and the person's fulfilment are three different facts, and none of them is a real card payment or real USDC in a wallet. Say what you could not observe.
