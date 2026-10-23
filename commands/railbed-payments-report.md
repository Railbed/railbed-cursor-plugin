---
name: railbed-payments-report
description: Total paid payments for a period with railbed_get_payment_summary, each currency and settlement asset kept separate.
---

Use the `inspect-payments` skill.

State the connected business and mode. Confirm the period and timezone with me if my request leaves either open, then call `railbed_get_payment_summary` with ISO `from` and `to` that carry the offset, start inclusive and end exclusive, in intervals of at most 31 days. Report the paid payment count, each currency's order total on its own line, and the reported settlement by method, network and coin with any missing-value counts. Say that these are stored records by `paid_at`, not a wallet balance, and label Test figures as simulated. Do not use a page of payments as a total.
