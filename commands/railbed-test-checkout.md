---
name: railbed-test-checkout
description: Simulate paid, underpaid, declined and failed outcomes on a started Test payment and check webhooks and fulfilment.
---

Use the `test-railbed-checkout` skill.

Confirm with `railbed_get_connection` that the connection is Test mode with Full access; if it is Live, stop and tell me. Remind me that my Test webhook endpoints will receive real signed requests. Help me get a started Test payment, from my integration or from a Test payment link I confirm, then run `railbed_simulate_payment` for each outcome I want, with a fresh payment for each one that finishes a payment. After each, show the stored status and the deliveries recorded for that payment, and ask what my receiver and fulfilment did. Report every outcome with its payment id, and keep simulated settlement, delivered webhooks and my fulfilment as separate claims.
