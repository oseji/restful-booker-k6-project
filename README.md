# RESTful Booker — k6 API & Performance Test Suite

A k6-based test suite covering the full booking lifecycle on the [restful-booker](https://restful-booker.herokuapp.com/) demo API — authentication, creation, updates, deletion, and cleanup verification — combined with per-endpoint performance thresholds and a staged load profile.

This project was built as a hands-on introduction to k6, following a learn-by-doing approach: each script was written independently, run against the real API, debugged from actual terminal output, and iteratively refined based on what the API's real (and sometimes deliberately buggy) behavior revealed.

## What this suite covers

- **Authentication** — token-based login via `POST /auth`, with checks confirming both HTTP status and that a real token was returned (not just that the request didn't error)
- **Full booking lifecycle** — create → update → delete → verify deletion, chained in a single flow with each step depending on data extracted from the one before it
- **Business-logic assertions**, not just status codes — every step confirms the _data_ is correct (e.g., an updated `totalprice` actually reflects the new value, a deleted booking genuinely returns `404` on a follow-up lookup)
- **Unique data per iteration** — every booking is generated with a fingerprint derived from the VU and iteration number, so a response can always be traced back to the exact iteration that produced it
- **Per-endpoint thresholds** — in the lifecycle test, response time and check pass rate are budgeted for each step of the journey individually, not just averaged across the run
- **A staged load profile** — ramp-up, genuine steady-state, and a graduated ramp-down, modeling realistic traffic rather than a flat burst
- **A deliberately handled negative test case** — confirming a deletion succeeded by asserting on an _expected_ `404`, including correctly reclassifying that response so it isn't mistaken for a genuine failure

## Project structure

```
tests/
  auth/
    auth.js               # Standalone authentication flow test
  bookings/
    createBooking.js      # Focused creation test (cleans up what it creates)
    bookingLifecycle.js   # Full create → update → delete → verify journey
utils/
  baseHeaders.js          # Shared request headers + Cookie auth helper
  bookingData.js          # Randomized, iteration-unique booking payloads
  config.js               # Base URL and credentials, overridable via env vars
  getAuthResponse.js      # Reusable auth helper, returns the full HTTP response
package.json
```

## Running the tests

```bash
npm install
npm run auth              # Authentication flow only
npm run createBooking     # Booking creation only
npm run bookingLifecycle  # Full booking lifecycle under staged load
```

### Configuration

Nothing about the target is hardcoded into the test logic. Override via environment variables:

| Variable        | Default                               | Purpose                    |
| --------------- | ------------------------------------- | -------------------------- |
| `BASE_URL`      | `https://restful-booker.herokuapp.com` | Target environment         |
| `AUTH_USERNAME` | `admin`                               | Auth username              |
| `AUTH_PASSWORD` | `password123`                         | Auth password              |

```bash
BASE_URL=https://staging.example.com npm run bookingLifecycle
```

(The default credentials are restful-booker's own publicly documented demo credentials — there is nothing secret here. The env vars exist so the suite can point at a real environment without a code change.)

Each script prints a summary of checks and thresholds on completion. A non-zero exit code indicates a threshold was crossed — even if every individual check passed — since checks and thresholds measure different things (see below).

## Design decisions

**Checks vs. thresholds.** Checks validate business logic per request (did the right data come back?); thresholds validate performance and reliability across the whole run (was it fast and stable enough, in aggregate?). The two are genuinely independent: a run can have 100% of its checks pass while failing a threshold, and — as in the snapshot below — can have a handful of checks fail while every threshold still passes, because the failure rate stayed inside its budget.

**Thresholds are per-endpoint, not just run-wide.** A single run-wide `http_req_duration` threshold averages a slow `DELETE` and a fast `auth` into one number that diagnoses nothing. In `bookingLifecycle.js` each step is tagged (`endpoint:auth`, `endpoint:create`, …) and given its own latency and check-rate budget, so a regression points at the endpoint that caused it. `createBooking.js` uses the same mechanism more narrowly — its budget is scoped to `{endpoint:create}` so the auth and cleanup calls it makes as scaffolding don't move the number it reports on. `auth.js` is a single-request test, so a run-wide threshold is already per-endpoint.

**Threshold values were chosen from observed data, not copied from a template.** Response times against this instance sit around 210–260ms at the median; the 500ms `p(95)` budget was set with headroom above that observed baseline rather than picked arbitrarily. `auth` carries a wider 600ms budget: it showed the highest `p(95)` of any step in the staged run below, and it is the one step every other step is blocked on, so a marginal auth slowdown is worth tolerating rather than failing the run over.

**Every booking is unique to the iteration that created it.** Rather than firing the same static payload from every VU, `utils/bookingData.js` generates randomized names, prices, deposit flags and date ranges, and stamps the surname with the VU and iteration number (`Okafor-vu12-iter438`). This exercises real data variance and lets each response be tied back to the request that caused it — a static payload can't distinguish "the API echoed my booking" from "the API echoed someone else's identical booking".

**Load shape was kept deliberately modest.** restful-booker is a small, shared, community-maintained demo instance, not dedicated load-testing infrastructure. Peak concurrency and total request volume were kept intentionally conservative to be a considerate user of shared public infrastructure, rather than maximizing raw numbers for their own sake.

**The suite cleans up after itself.** Every booking created during a run is deleted before that iteration ends — in the lifecycle test as the subject of the journey, and in the creation test as an explicit teardown step. The lifecycle test independently verifies the deletion via a follow-up lookup, so cleanup is asserted rather than assumed. The one exception is a `DELETE` that itself fails under load (see quirk 6): those bookings do survive the run. The suite doesn't retry them, since a silent retry would hide exactly the failure the test exists to surface.

**The chain bails out instead of cascading.** If auth returns no token, or create returns no booking id, the iteration returns early. Without those guards a failed create would send every downstream request to `/booking/undefined`, burying the one real failure under a pile of meaningless derived ones.

**Shared logic is modularized.** Headers, auth, config and data generation live in `utils/` and are imported where needed rather than duplicated across scripts — mirroring standard practice for reusable, maintainable test suites.

## Bugs and quirks discovered

Testing this API surfaced several real inconsistencies, each confirmed by inspecting actual request/response data rather than assumed:

1. **`POST /booking` and `PUT /booking/{id}` silently require an `Accept: application/json` header.** Omitting it — even with a perfectly valid JSON body and correct `Content-Type` — returns `418 I'm a Teapot` instead of a meaningful error.
2. **Write operations (`PUT`, `DELETE`) authenticate via a `Cookie: token=<value>` header, not the more conventional `Authorization: Bearer <value>`.** Sending a Bearer token returns `403 Forbidden` with no further explanation.
3. **A successful `DELETE` returns `201 Created`**, rather than the conventional `200 OK` or `204 No Content` — an unusual choice for an operation that removes a resource rather than creating one.
4. **The `DELETE` response body is plain text (`"Created"`), not JSON** — inconsistent with every other endpoint in the API, which return structured JSON.
5. **The API accepts bookings where the checkout date is earlier than the check-in date**, with no validation error raised. Found while exploring the API by hand; the suite doesn't assert on it, and `utils/bookingData.js` deliberately generates only valid ranges so the tests never depend on the bug being there.
6. **Write operations occasionally fail under sustained concurrency.** At 25 VUs a small number of `PUT`/`DELETE` requests time out or error (~0.07% of requests in the run below), with tail latencies spiking past 5s while the median holds around 220ms. Consistent with a small shared Heroku instance rather than a defect in the API's logic.

## Results snapshot

From a full staged run (ramp-up → steady state → graduated ramp-down, peaking at 25 concurrent VUs over ~4m10s):

| Metric                     | Result                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| Checks passed              | 20,208 / 20,220 (99.94%) — threshold: > 99%                                 |
| Requests failed            | 0.07% (8 / 10,110) — threshold: < 1%                                        |
| `http_req_duration` p(95)  | 314ms (threshold: < 500ms)                                                  |
| Median response time       | 219ms                                                                       |
| Total iterations completed | 2,022 full lifecycle runs                                                   |
| Total HTTP requests        | 10,110 (5 per iteration, as expected: auth, create, update, delete, verify) |

All thresholds passed, run-wide and per-endpoint. Per-endpoint `p(95)`:

| Endpoint        | p(95) | Budget |
| --------------- | ----- | ------ |
| `auth`          | 334ms | 600ms  |
| `create`        | 313ms | 500ms  |
| `update`        | 325ms | 500ms  |
| `delete`        | 314ms | 500ms  |
| `verifyDeleted` | 297ms | 500ms  |

The 12 failed checks (2 update, 6 delete, and their knock-on assertions) are the shared instance struggling under concurrency, not a logic error — see quirk 6 above. This is exactly the case the thresholds exist to adjudicate: individual checks failed, the failure rate stayed within budget, and the run correctly passed.

## Possible future improvements

- Extend coverage to additional endpoints (e.g., filtered booking searches)
- Add further negative/edge-case tests (malformed payloads, invalid data types)
- Add CI to run a smoke profile on every push
- Visualize results over time with Grafana
- Migrate to TypeScript once the suite's scope grows further

## About this project

Built as part of a hands-on transition from frontend/UI test automation (Selenium, WebdriverIO, Playwright) toward performance and API testing, with a focus on understanding _why_ each tool and pattern works, not just reproducing working code.
