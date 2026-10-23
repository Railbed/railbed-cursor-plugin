---
name: railbed-integrate
description: Implement or extend a Railbed integration (hosted checkout, own-UI flow, payment links or webhooks) from the current docs.
---

Use the `integrate-railbed` skill.

Work out which shape I need from my request and the code, read the current contract with `railbed_docs_search` and `railbed_docs_read`, and cite the URLs you relied on. Keep secret keys and signing secrets as environment-variable names, call the API only from the server, save an idempotency key before creating a session, verify webhook signatures on the raw body, and fulfil only from a verified `paid`. If no repository is open, give me the snippets and the steps to run on my server. Finish with what you verified and what still has to happen in Railbed Developers.
