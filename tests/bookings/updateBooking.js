import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
    iterations: 10,
};

const baseUrl = "https://restful-booker.herokuapp.com";

const bookingData = {
    firstname: "Ose",
    lastname: "Oziegbe",
    totalprice: 255000,
    depositpaid: true,
    bookingdates: {
        checkin: "2026-07-13",
        checkout: "2026-07-20",
    },
    additionalneeds: "Breakfast and Lunch",
};

const bookingPayload = JSON.stringify(bookingData);

const bookingParams = {
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
};

const updatedBookingData = {
    firstname: "Ose",
    lastname: "Oziegbe",
    totalprice: 300000, // changed from 255000, so we can verify the update took effect
    depositpaid: true,
    bookingdates: {
        checkin: "2026-07-13",
        checkout: "2026-07-20",
    },
    additionalneeds: "Breakfast and Lunch",
};

const updatedPayload = JSON.stringify(updatedBookingData);

export default function () {
    // Step 1: Authenticate — get a fresh token for this iteration
    const authResponse = http.post(
        `${baseUrl}/auth`,
        JSON.stringify({ username: "admin", password: "password123" }),
        { headers: { "Content-Type": "application/json" } },
    );

    const authToken = authResponse.json("token");

    check(authResponse, {
        "auth status is 200": (r) => r.status === 200,
        "auth token is not undefined": (r) => r.json("token") !== undefined,
    });

    // Step 2: Create a booking — this generates the ID we'll update next
    const createResponse = http.post(
        `${baseUrl}/booking`,
        bookingPayload,
        bookingParams,
    );

    const bookingId = createResponse.json("bookingid");

    check(createResponse, {
        "create status is 200": (r) => r.status === 200,
        "bookingId is not undefined": (r) => r.json("bookingid") !== undefined,
    });

    // Step 3: Update that specific booking using the token from Step 1
    const updateUrl = `${baseUrl}/booking/${bookingId}`;

    const updateParams = {
        headers: {
            "Content-Type": "application/json",
            Cookie: `token=${authToken}`,
        },
    };

    const updateResponse = http.put(updateUrl, updatedPayload, updateParams);

    check(updateResponse, {
        "update status is 200": (r) => r.status === 200,
        "totalprice was updated": (r) => r.json("totalprice") === 300000,
    });

    sleep(1);
}
