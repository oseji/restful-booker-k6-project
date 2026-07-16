import http from "k6/http";
import { BASE_HEADERS } from "./baseHeaders.js";
import { BASE_URL, CREDENTIALS } from "./config.js";

const payload = JSON.stringify(CREDENTIALS);

export const getAuthResponse = () =>
    http.post(`${BASE_URL}/auth`, payload, {
        headers: BASE_HEADERS,
        tags: { endpoint: "auth" },
    });
