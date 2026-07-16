import http from "k6/http";
import { sleep, check } from "k6";
import { authHeaders, BASE_HEADERS } from "../../utils/baseHeaders.js";
import { getAuthResponse } from "../../utils/getAuthResponse.js";
import { buildBooking } from "../../utils/bookingData.js";
import { BASE_URL } from "../../utils/config.js";

export const options = {
    thresholds: {
        // run-wide aggregates.
        http_req_duration: ["p(95)<500"],
        http_req_failed: ["rate<0.01"],
        checks: ["rate>0.99"],

        // per endpoint thresholds - without these, a slow delete and a fast auth average into a single number that diagnoses nothing.
        "http_req_duration{endpoint:auth}": ["p(95)<600"],
        "http_req_duration{endpoint:create}": ["p(95)<500"],
        "http_req_duration{endpoint:update}": ["p(95)<500"],
        "http_req_duration{endpoint:delete}": ["p(95)<500"],
        "http_req_duration{endpoint:verifyDeleted}": ["p(95)<500"],

        // every step must be individually reliable, not just reliable on average.
        "checks{endpoint:auth}": ["rate>0.99"],
        "checks{endpoint:create}": ["rate>0.99"],
        "checks{endpoint:update}": ["rate>0.99"],
        "checks{endpoint:delete}": ["rate>0.99"],
        "checks{endpoint:verifyDeleted}": ["rate>0.99"],
    },
    stages: [
        { duration: "30s", target: 20 }, // ramp up
        { duration: "1m", target: 25 }, // ramp up
        { duration: "1m", target: 25 }, // steady state
        { duration: "1m", target: 10 }, // ramp down
        { duration: "30s", target: 5 }, // ramp down
        { duration: "10s", target: 0 }, // ramp down
    ],
};

export default function () {
    // authenticate and extract a fresh token for this iteration
    const authResponse = getAuthResponse();
    const authToken = authResponse.json("token");

    check(
        authResponse,
        {
            "auth status is 200": (r) => r.status === 200,
            "auth token was returned": (r) => r.json("token") != null,
        },
        { endpoint: "auth" },
    );

    if (!authToken) {
        // nothing downwards can authenticate if auth token is'nt valid so exit rather than firing more requests that are guaranteed to 403.
        return;
    }

    // create a booking with data unique to this VU/iteration
    const booking = buildBooking();

    const createResponse = http.post(
        `${BASE_URL}/booking`,
        JSON.stringify(booking),
        { headers: BASE_HEADERS, tags: { endpoint: "create" } },
    );

    const bookingId = createResponse.json("bookingid");

    check(
        createResponse,
        {
            "create status is 200": (r) => r.status === 200,
            "bookingId was returned": (r) => r.json("bookingid") != null,
            "created booking echoes the name we sent": (r) =>
                r.json("booking.lastname") === booking.lastname,
        },
        { endpoint: "create" },
    );

    if (bookingId == null) {
        // without an id every subsequent request would hit /booking/undefined and pollute the metrics with meaningless failures.
        return;
    }

    // update the booking just created
    const bookingUrl = `${BASE_URL}/booking/${bookingId}`;

    const updatedBooking = {
        ...booking,
        totalprice: booking.totalprice + 50000,
        additionalneeds: "Updated: late checkout",
    };

    const updateResponse = http.put(
        bookingUrl,
        JSON.stringify(updatedBooking),
        { headers: authHeaders(authToken), tags: { endpoint: "update" } },
    );

    check(
        updateResponse,
        {
            "update status is 200": (r) => r.status === 200,
            "totalprice reflects the update": (r) =>
                r.json("totalprice") === updatedBooking.totalprice,
            "additionalneeds reflects the update": (r) =>
                r.json("additionalneeds") === updatedBooking.additionalneeds,
        },
        { endpoint: "update" },
    );

    // delete the booking, leaving no residual data on the shared instance
    const deleteResponse = http.del(bookingUrl, null, {
        headers: authHeaders(authToken),
        tags: { endpoint: "delete" },
    });

    check(
        deleteResponse,
        {
            // restful-booker returns 201 for a successful DELETE — see README
            "delete status is 201 (RESTFUL BOOKER SPECIFIC)": (r) =>
                r.status === 201,
        },
        { endpoint: "delete" },
    );

    // confirm the deletion actually worked - a 404 here is the success case, so it is reclassified as expected and kept out of http_req_failed by using responseCallback: http.expectedStatuses(404)
    const verifyDeletedResponse = http.get(bookingUrl, {
        headers: authHeaders(authToken),
        tags: { endpoint: "verifyDeleted" },
        responseCallback: http.expectedStatuses(404),
    });

    check(
        verifyDeletedResponse,
        {
            "deleted booking no longer exists": (r) => r.status === 404,
        },
        { endpoint: "verifyDeleted" },
    );

    sleep(1);
}
