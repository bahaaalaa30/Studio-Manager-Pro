import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExpectedDeliveryTime,
  validatePaidAmount,
} from "./order-calculations.ts";

const createdAt = "2026-08-12T10:00:00.000Z";

function expectedDate(days: number): string {
  const date = new Date(createdAt);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

test("personal photos: normal delivery is next day", () => {
  const result = calculateExpectedDeliveryTime(
    [{ serviceType: "personal_photos_8pack" }],
    createdAt,
  );
  assert.equal(result.toISOString(), expectedDate(1));
});

test("personal photos: urgent delivery is same day", () => {
  const result = calculateExpectedDeliveryTime(
    [
      { serviceType: "personal_photos_8pack" },
      { serviceType: "urgent_fee" },
    ],
    createdAt,
  );
  assert.equal(result.toISOString(), expectedDate(0));
});

test("card photos: normal delivery is two days", () => {
  const result = calculateExpectedDeliveryTime(
    [{ serviceType: "card_photos_1pack" }],
    createdAt,
  );
  assert.equal(result.toISOString(), expectedDate(2));
});

test("card photos: urgent delivery is next day", () => {
  const result = calculateExpectedDeliveryTime(
    [
      { serviceType: "card_photos_1pack" },
      { serviceType: "urgent_fee" },
    ],
    createdAt,
  );
  assert.equal(result.toISOString(), expectedDate(1));
});

test("personal + card: normal delivery is two days", () => {
  const result = calculateExpectedDeliveryTime(
    [
      { serviceType: "personal_photos_8pack" },
      { serviceType: "card_photos_1pack" },
    ],
    createdAt,
  );
  assert.equal(result.toISOString(), expectedDate(2));
});

test("personal + card: urgent delivery is next day", () => {
  const result = calculateExpectedDeliveryTime(
    [
      { serviceType: "personal_photos_8pack" },
      { serviceType: "card_photos_1pack" },
      { serviceType: "urgent_fee" },
    ],
    createdAt,
  );
  assert.equal(result.toISOString(), expectedDate(1));
});

test("invalid createdAt is rejected", () => {
  assert.throws(
    () => calculateExpectedDeliveryTime([], "not-a-date"),
    /Invalid createdAt date/,
  );
});

test("paid amount equal to total is valid", () => {
  assert.equal(validatePaidAmount(80, 80), null);
});

test("negative paid amount is rejected", () => {
  assert.equal(
    validatePaidAmount(-1, 80),
    "Paid amount cannot be negative",
  );
});

test("paid amount above total is rejected", () => {
  assert.equal(
    validatePaidAmount(81, 80),
    "Paid amount cannot exceed order total of 80.00",
  );
});

test("non-finite paid amount is rejected", () => {
  assert.equal(
    validatePaidAmount(Number.NaN, 80),
    "Paid amount must be a valid number",
  );
});
