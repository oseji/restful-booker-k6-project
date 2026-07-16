import http from "k6/http";
import { BASE_HEADERS } from "./baseHeaders.js";
import { BASE_URL, CREDENTIALS } from "./config.js";

const payload = JSON.stringify(CREDENTIALS);

export const getAuthResponse = () =>
    http.post(`${BASE_URL}/auth`, payload, {
        headers: BASE_HEADERS,
        tags: { endpoint: "auth" },
    });

// what counts as a usable token, defined once. the checks and the early-return guards both ask this, so they can't drift apart and disagree about whether a login worked. a failed login can still answer 200 with an empty token.
export const isValidToken = (token) => token != null && token !== "";
