const MOBILE_PATTERN = /^01\d{9}$/;

function validateName(value: string): string {
  if (!value.trim()) return "Name is required.";
  return "";
}

function validateMobile(value: string): string {
  if (!value) return "Mobile number is required.";
  if (!/^\d+$/.test(value)) return "Mobile number must contain numbers only.";
  if (!MOBILE_PATTERN.test(value)) return "Mobile number must start with 01 and contain 11 digits.";
  return "";
}

function applyValidation(input: HTMLInputElement): void {
  const message = input.id === "customerName"
    ? validateName(input.value)
    : validateMobile(input.value);

  input.setCustomValidity(message);
  input.dataset.invalid = message ? "true" : "false";
}

export function installCustomerValidation(): void {
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.id === "customerMobile") {
      const digitsOnly = target.value.replace(/\D/g, "").slice(0, 11);
      if (target.value !== digitsOnly) target.value = digitsOnly;
    }

    if (target.id === "customerName" || target.id === "customerMobile") {
      applyValidation(target);
    }
  }, true);

  document.addEventListener("blur", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === "customerName" || target.id === "customerMobile") {
      applyValidation(target);
    }
  }, true);

  document.addEventListener("invalid", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === "customerName" || target.id === "customerMobile") {
      applyValidation(target);
    }
  }, true);
}
