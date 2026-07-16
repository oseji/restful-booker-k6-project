import http from "k6/http";
import { sleep, check } from "k6";
import { authHeaders, BASE_HEADERS } from "../../utils/baseHeaders.js";
import { getAuthResponse } from "../../utils/getAuthResponse.js";
import { buildBooking } from "../../utils/bookingData.js";
import { BASE_URL } from "../../utils/config.js";

export const options = {
    thresholds: {
        http_req_failed: ["rate<0.01"],
        checks: ["rate>0.99"],
        "http_req_duration{endpoint:create}": ["p(95)<500"],
    },
    stages: [
        { duration: "30s", target: 5 }, // ramp up
        { duration: "1m", target: 5 }, // steady state
        { duration: "20s", target: 0 }, // ramp down
    ],
};

export default function () {
    const booking = buildBooking();

    const response = http.post(`${BASE_URL}/booking`, JSON.stringify(booking), {
        headers: BASE_HEADERS,
        tags: { endpoint: "create" },
    });

    const bookingId = response.json("bookingid");

    check(response, {
        "status is 200": (r) => r.status === 200,
        "bookingId was returned": (r) => r.json("bookingid") != null,
        "created booking echoes the name we sent": (r) =>
            r.json("booking.lastname") === booking.lastname,
        "created booking echoes the price we sent": (r) =>
            r.json("booking.totalprice") === booking.totalprice,
    });

    // clean up due to restful-booker being a shared community instance, and a create only test would leave a booking behind per iteration.
    if (bookingId != null) {
        const authToken = getAuthResponse().json("token");

        if (authToken) {
            http.del(`${BASE_URL}/booking/${bookingId}`, null, {
                headers: authHeaders(authToken),
                tags: { endpoint: "cleanup" },
            });
        }
    }

    sleep(1);
}
