import exec from "k6/execution";

const FIRST_NAMES = [
    "Ose",
    "Amara",
    "Tunde",
    "Chidi",
    "Zainab",
    "Kemi",
    "Ifeanyi",
];
const LAST_NAMES = ["Oziegbe", "Okafor", "Adeyemi", "Balogun", "Eze", "Nwosu"];
const ADDITIONAL_NEEDS = [
    "Breakfast",
    "Breakfast and Lunch",
    "Late checkout",
    "Airport transfer",
    "None",
];

const randomFrom = (list) => list[Math.floor(Math.random() * list.length)];
const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const isoDate = (date) => date.toISOString().split("T")[0];

// check-in is always in the future and check-out always after it — the API happily accepts the reverse (see README), so the suite avoids relying on that bug.
const randomBookingDates = () => {
    const checkin = new Date();
    checkin.setDate(checkin.getDate() + randomInt(1, 90));

    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + randomInt(1, 14));

    return { checkin: isoDate(checkin), checkout: isoDate(checkout) };
};

// builds a booking payload unique to the VU/iteration that requested it.The VU id and iteration number are globally unique across a run, so the generated `lastname` acts as a fingerprint: a booking can always be traced back to the exact iteration that created it, and no two iterations can be confused for one another.

export const buildBooking = (overrides = {}) => ({
    firstname: randomFrom(FIRST_NAMES),
    lastname: `${randomFrom(LAST_NAMES)}-vu${exec.vu.idInTest}-iter${exec.scenario.iterationInTest}`,
    totalprice: randomInt(100, 5000) * 100,
    depositpaid: Math.random() < 0.5,
    bookingdates: randomBookingDates(),
    additionalneeds: randomFrom(ADDITIONAL_NEEDS),
    ...overrides,
});
