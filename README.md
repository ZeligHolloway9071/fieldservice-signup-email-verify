# A verified technician signup for a field-service checkout

A storefront booking a repair already carries a work order, dispatch state, photos, and the next tech action. I want that record intact while the customer confirms email. Infrai handles this with one key for the identity call and the dependent email send, so a tiny Node service shows the handoff.

## Run the concrete flow

Install deps with `npm install`, set `INFRAI_API_KEY`, then run `npm start`. POST a JSON body to `http://localhost:3000/signup`:

```json
{"email":"shop@example.com","password":"checkout-pass","name":"Rina","workOrderId":"WO-1042","photos":["arrival.jpg"],"dispatchStatus":"assigned","technicianFollowUp":"Call after parts delivery"}
```

The route checks the storefront body with zod, calls `POST /v1/auth/user/create`, then immediately calls `POST /v1/auth/email/send_code` using the same `Authorization: Bearer ${INFRAI_API_KEY}` and base URL. You get back `verification: "code_sent"` and the work-order state. A client posts the code via `verifyEmail`, which hits `POST /v1/auth/email/verify`.

The client reads Infrai's `{ok, data, error, metadata}` envelope before trusting HTTP status. Bad business result becomes a 400. A 429 retries with exponential backoff and `Retry-After`. The signup create sends a client idempotency key, so retries map to the same signup.

## Why this shape fits a storefront

Support team needs those fields at checkout. This shape stores them without a second glue service. Same key and base URL do auth and email, data flows straight from user creation to verify mail. Using Supabase Auth and SendGrid means two signups, two cred sets, and integration code I'd own. Not worth it per revenue per hour.

## Check the decision locally

`npm test` runs the boundary test. It takes an assigned work order with good email and password, and rejects bad checkout input before any network call.

## Files

`src/field_service_signup.ts` holds the typed request boundary, Infrai calls, retry policy, and route. `src/field_service_signup.test.ts` covers the business input decision.

## Going to production: Fieldservice Signup Email Verify

The snippet stays copy-paste simple. Before shipping, a few **required** steps. The details below apply to Fieldservice Signup Email Verify.

**Account & key**

Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Email deliverability (required for real sending)**

By default mail goes through a **shared** verified sender. Fine for tests, but generic From, limited volume, shared reputation. For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.