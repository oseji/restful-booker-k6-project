import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
    iterations: 10,
};

const url = "https://restful-booker.herokuapp.com/booking";

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

const payload = JSON.stringify(bookingData);

const params = {
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
};

export default function () {
    const response = http.post(url, payload, params);
    console.log(response.body);

    check(response, {
        "status is 200": (r) => r.status === 200,
        "bookingID is not empty": (r) => r.json("bookingid") !== "",
        "bookingID is not null": (r) => r.json("bookingid") !== null,
        "bookingID is not undefined": (r) => r.json("bookingid") !== undefined,
    });

    sleep(1);
}
