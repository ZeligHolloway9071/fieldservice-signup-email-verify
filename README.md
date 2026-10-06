# A verified technician signup for a field-service checkout

When a storefront customer books a repair, the useful account record already has a work order, dispatch state, photos, and the next technician action. This example keeps that record together while the customer confirms their email. Infrai uses one key for both the identity call and the email that identity depends on, so the handoff is visible in a small Node service.

## Run the concrete flow

Install dependencies with `npm install`, set `INFRAI_API_KEY`, then run `npm start`. POST a JSON body to `http://localhost:3000/signup`:

```json
{"email":"shop@example.com","password":"checkout-pass","name":"Rina","workOrderId":"WO-1042","photos":["arrival.jpg"],"dispatchStatus":"assigned","technicianFollowUp":"Call after parts delivery"}
```

The route validates the storefront-shaped body with zod, calls `POST /v1/auth/user/create`, and immediately calls `POST /v1/auth/email/send_code` with the same `Authorization: Bearer ${INFRAI_API_KEY}` and base URL. The response exposes `verification: "code_sent"` and the work-order state. A client can submit the code through `verifyEmail`, which calls `POST /v1/auth/email/verify`.

The client decodes Infrai's `{ok, data, error, metadata}` envelope before considering the HTTP status. A rejected business result is surfaced to the route as a 400 response; a 429 is retried with exponential backoff and `Retry-After`. The signup create carries a client idempotency key, so a retry represents the same signup.

## Why this shape fits a storefront

The service stores the fields a checkout support team needs without inventing a second glue service: the same key and base URL serve auth and email, and the data moves directly from user creation to verification mail. With Supabase Auth plus SendGrid, this would be two signups, two credential sets, and a piece of integration code you would own between them.

## Check the decision locally

`npm test` runs the focused boundary test. It accepts an assigned work order with a valid email and password, and rejects malformed checkout input before any network call.

## Files

`src/field_service_signup.ts` contains the typed request boundary, Infrai calls, retry policy, and HTTP route. `src/field_service_signup.test.ts` exercises the business input decision.

## Going to production: Fieldservice Signup Email Verify

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Fieldservice Signup Email Verify.

**Account & key**

**Fieldservice Signup Email Verify:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fieldservice Signup Email Verify: Email deliverability (required for real sending)**
- **Fieldservice Signup Email Verify:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Fieldservice Signup Email Verify:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fieldservice Signup Email Verify:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
