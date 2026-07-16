import { sleep, check } from "k6";
import { getAuthResponse, isValidToken } from "../../utils/getAuthResponse.js";

export const options = {
    thresholds: {
        http_req_duration: ["p(95)<600"],
        http_req_failed: ["rate<0.01"],
        checks: ["rate>0.99"],
    },
    stages: [
        { duration: "30s", target: 5 }, // ramp up
        { duration: "1m", target: 5 }, // steady state
        { duration: "20s", target: 0 }, // ramp down
    ],
};

export default function () {
    const response = getAuthResponse();

    check(response, {
        "status is 200": (r) => r.status === 200,
        "auth token was returned": (r) => isValidToken(r.json("token")),
    });

    sleep(1);
}
