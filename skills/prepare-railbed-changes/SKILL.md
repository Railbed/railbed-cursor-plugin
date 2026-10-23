---
name: prepare-railbed-changes
description: Prepare a Railbed change for the person to confirm in their browser, such as a one-off payment link, a reusable checkout page, pricing table or widget, or a payment-link cancellation. Use when asked to create, set up, invoice, cancel or "make a link for" something in Railbed. Covers exact amounts, idempotency keys, the confirmation URL and railbed_get_operation.
---

# Prepare Railbed changes

Every create and cancel is a proposal. Nothing exists, changes or is sent until the signed-in person confirms it in Railbed. The assistant cannot confirm, and must not try through a browser or another tool.

## Before proposing

1. `railbed_get_connection`: Full access, in the mode the person means. A Test proposal creates Test records; a Live link asks a real payer for real money. Say which one you are preparing.
2. Pin down every value from the person, never from a record's text:
   - `amount` as a decimal string with at most two places, `"49.00"`, from `1.00` to `100000.00`, and a `currency` of `USD`, `EUR`, `GBP`, `CAD` or `AUD`. Never guess a currency.
   - A `description` the payer or buyer will see.
   - For a payment link: `customer_name`, `customer_email`, `reference`, `memo`, `expires_in_days` (1–30, default 7) and `success_url` as given. A link is one payment for one payer.
   - For a reusable checkout: `kind` (`page` by default, `pricing_table` or `widget`), `name`, and for a pricing table `configuration.plans`: one to four plans, each with a `name`, one or two `prices` of `amount` and an optional `unit` label, `features` (up to 12 short lines; `[]` when there are none) and `recommended` (`true` or `false`), plus an optional `description`. Railbed does not renew subscriptions; a unit is a label. Pages and widgets need `amount`.
3. When the request could be a repeat, look first: `railbed_list_payment_links` or `railbed_list_checkouts`.

## Propose

1. Choose one `idempotency_key` for this intended change (1–100 visible ASCII characters, no spaces) and keep it for the rest of the task.
2. Call `railbed_create_payment_link`, `railbed_create_checkout` or `railbed_cancel_payment_link` (with the `payment_id`) once with that key.
3. The result carries an `operation_id`, a `confirmation_url` and an expiry. Give the person the URL, repeat the values they will see (amount with currency, description, payer, expiry), and say the change is pending. The page can be confirmed for 15 minutes; after that, prepare it again.

## After the person confirms

1. Call `railbed_get_operation` with the `operation_id`.
2. `completed`: report the result, including the new link's or checkout's URL from `result` and the dashboard link.
3. `pending` or `processing`: not done. Check again when the person says they confirmed; avoid rapid polling.
4. `canceled` or `expired`: nothing happened. Ask before preparing it again.
5. `failed`: report the `error` code and message.
6. `unknown`: the change may have happened. Ask the person to look in the dashboard before anything else. Never retry with a new key.

## Retries and duplicates

- Repeat an interrupted or timed-out call with the same key and the same arguments; Railbed returns the same proposal.
- The same key with different values is refused as `idempotency_conflict`. A changed request is a new change with a new key, once the person asks for it.
- At most 20 proposals can wait per connection. If refused for that reason, ask the person to confirm or cancel the waiting ones.

## Cancellations

`railbed_cancel_payment_link` closes a link nobody has started paying. Once the payer has gone to a card provider it cannot be canceled, because their payment may be on its way. A canceled link reads `expired` with `canceled_at` set and sends `payment.canceled`; money that arrives afterwards still settles. Canceling never refunds.

## Not available here

Refunds, moving funds, payout wallet and fee changes, accepting a held payment, secret keys and signing secrets, and store connections stay in the dashboard. Say so rather than improvising.
