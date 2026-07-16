export const BASE_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json",
};

export const authHeaders = (token) => ({
    ...BASE_HEADERS,
    Cookie: `token=${token}`,
});
