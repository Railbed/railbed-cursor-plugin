---
name: diagnose-webhooks
description: Investigate Railbed webhook problems. List endpoints and delivery outcomes, explain HTTP codes, retries and signature failures, and prepare an endpoint change or test send for the person to confirm in Railbed. Use when deliveries fail, a receiver gets nothing, a signature does not match, or an endpoint must be added, edited or removed.
---

# Diagnose webhooks

## Look before anything else

1. `railbed_get_connection`: name the business and mode. Test endpoints receive only Test events and Live endpoints only Live events, so a missing webhook is often in the other mode.
2. `railbed_list_webhooks`: each endpoint's id, URL (query values redacted), events and whether it is enabled. An endpoint added before September 26, 2026 receives only `payment.paid` and `payment.failed` until its events are edited.
3. `railbed_list_webhook_deliveries` with the `endpoint_id`, optionally `status` `pending`, `delivered` or `failed`: event type, payment id, attempts, HTTP status and times. Deliveries carry no payload and no secret.

## Read the evidence honestly

- A 2xx means the receiver answered within 10 seconds. It does not prove the signature was checked, the order was fulfilled or money settled.
- A 4xx usually comes from the receiver's own checks: a signature mismatch (a re-serialized body, a secret with a trailing newline or space, or the secret from the other mode), an unknown event type rejected instead of acknowledged, or a sample event (`metadata.sample` is `"true"`, order `ord_sample`) the receiver tried to read back and got a 404 for.
- A 3xx is a failure: redirects are not followed. Use the final address.
- A 5xx or a timeout points at the receiver; fulfilment inside the request runs past 10 seconds.
- Retries come 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 12 hours after each failure, seven attempts over about 21 hours, each with a fresh `t` and `v1`. The same event id can arrive more than once, and events can arrive out of order.
- Test sends and resends are never retried.

Confirm the scheme with `railbed_docs_search` and `railbed_docs_read` (`webhooks`, `webhooks/signatures`, `webhooks/events`) and cite the URL: `Railbed-Signature: t=…,v1=…`, HMAC-SHA256 over `{t}.{raw body}` with the `whsec_…` secret, a five-minute tolerance on `t`, every `v1` compared in constant time. If the person's receiver code is open, read it against those points. Without code, give the checklist and a snippet in their language.

## Prepare a change only when asked

Reading history never authorizes changing an endpoint or sending an event.

1. Get the exact receiver URL from the person: a public `https://` address with no username or password. Do not propose `localhost`, a private hostname or a tunnel address the person has not named; Live endpoints refuse non-public addresses. A tunnel for local work is a Test endpoint the person chooses.
2. Check `railbed_list_webhooks` for an existing endpoint with that address or purpose, and edit it rather than adding a duplicate. A business can have up to 10 endpoints per mode.
3. Save one `idempotency_key` for this change (1–100 visible ASCII characters, no spaces). Call `railbed_configure_webhook` with `action` `create`, `update` or `remove`, the `endpoint_id` for update and remove, and the `url`, `description` and `events` the person wants. For a send, call `railbed_test_webhook` with the `endpoint_id` and an `event`: `ping` by default; a Live endpoint accepts only `ping`, a Test endpoint can take any payment event as a sample.
4. Give the person the returned confirmation URL and say the change is pending. It can be confirmed for 15 minutes. Webhooks send payment and customer data to the confirmed address, and editing an address moves pending retries to it. Never confirm on their behalf.
5. After they confirm, call `railbed_get_operation` with the `operation_id`. Report success only when `state` is `completed`. `canceled`, `expired` and `failed` mean what they say. `unknown` means the change may have happened: ask the person to look in Developers before proposing anything else, and never retry with a new key.
6. Repeat an interrupted call with the same key and the same arguments; it returns the same proposal.

A test send to a Test endpoint is a real external HTTP request to the person's server. Signing secrets are never returned; the person reads or rolls them in Railbed Developers.

## Close

State what was observed, what was changed and confirmed, and what remains unverified, such as whether the receiver verified the signature or the person's system fulfilled.
