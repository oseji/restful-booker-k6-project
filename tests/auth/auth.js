import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
    iterations: 10,
};

const credentials = {
    username: "admin",
    password: "password123",
};

const url = "https://restful-booker.herokuapp.com/auth";

const payload = JSON.stringify(credentials);

const params = {
    headers: {
        "Content-Type": "application/json",
    },
};

export default function () {
    const response = http.post(url, payload, params);
    const authToken = response.json("token");
    // console.log(response.body);
    console.log(authToken);

    check(response, { "status is 200": (r) => r.status === 200 });
    check(response, {
        "auth token is not empty": () => authToken !== "",
        "auth token is not null": () => authToken !== null,
        "auth token is not undefined": () => authToken !== undefined,
    });

    sleep(1);
}
