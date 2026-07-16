// Single source of truth for where the suite points and who it authenticates as.
// Override at run time without touching code:
//   BASE_URL=https://staging.example.com npm run bookingLifecycle

export const BASE_URL =
    __ENV.BASE_URL || "https://restful-booker.herokuapp.com";

export const CREDENTIALS = {
    username: __ENV.AUTH_USERNAME || "admin",
    password: __ENV.AUTH_PASSWORD || "password123",
};
