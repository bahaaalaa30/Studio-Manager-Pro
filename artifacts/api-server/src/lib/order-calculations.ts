export type OrderServiceForDelivery = {
  serviceType: string;
};

/**
 * Calculates the expected delivery timestamp using the same business rules
 * currently used by the Reception UI.
 */
export function calculateExpectedDeliveryTime(
  services: OrderServiceForDelivery[],
  createdAt: Date | string,
): Date {
  const hasPersonal = services.some(
    (service) => service.serviceType === "personal_photos_8pack",
  );
  const hasCard = services.some(
    (service) => service.serviceType === "card_photos_1pack",
  );
  const isUrgent = services.some(
    (service) => service.serviceType === "urgent_fee",
  );

  let days = 0;
  if (hasPersonal && hasCard) {
    days = isUrgent ? 1 : 2;
  } else if (hasPersonal) {
    days = isUrgent ? 0 : 1;
  } else if (hasCard) {
    days = isUrgent ? 1 : 2;
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid createdAt date");
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function validatePaidAmount(
  paidAmount: number,
  totalAmount: number,
): string | null {
  if (!Number.isFinite(paidAmount)) {
    return "Paid amount must be a valid number";
  }
  if (paidAmount < 0) {
    return "Paid amount cannot be negative";
  }
  if (paidAmount > totalAmount) {
    return `Paid amount cannot exceed order total of ${totalAmount.toFixed(2)}`;
  }
  return null;
}
