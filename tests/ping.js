import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
    iterations: 10,
    thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<400"],
    },
};

export default function () {
    const response = http.get("https://restful-booker.herokuapp.com/ping");

    check(response, { "status is 201": (r) => r.status === 201 });

    sleep(1);
}
