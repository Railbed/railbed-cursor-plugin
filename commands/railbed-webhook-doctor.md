---
name: railbed-webhook-doctor
description: Diagnose failing Railbed webhook deliveries and, when asked, prepare an endpoint change or test send to confirm in Railbed.
---

Use the `diagnose-webhooks` skill.

Start with `railbed_get_connection`, `railbed_list_webhooks` and `railbed_list_webhook_deliveries` for the endpoint in question. Explain each failed delivery from its HTTP status and attempts, name the likely causes, and check my receiver code against the signature scheme in the docs if it is open. Change nothing unless I ask. If I ask for a change, use the exact public `https://` address I give you, check for an existing endpoint first, prepare it with one saved idempotency key, give me the confirmation link, and report it as done only when `railbed_get_operation` says `completed`.
