import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export function countryDialCodes(): { country: string; dial: string }[] {
  return getCountries().map((country) => ({ country, dial: getCountryCallingCode(country) }));
}

/** Splits a stored number back into the country + national parts a phone input edits. */
export function splitPhone(e164: string): { country: string; national: string } | null {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.country ? { country: parsed.country, national: parsed.nationalNumber } : null;
}

/** Returns the E.164 form (`+919876543210`) or null when the input is not a valid number. */
export function normalizePhone(input: string, defaultCountry: string): string | null {
  const cleaned = input.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as CountryCode);
  if (parsed?.isValid()) return parsed.number;
  // Bare international digits without "+" (e.g. an address local part like 14155550100).
  if (!cleaned.startsWith('+')) {
    const intl = parsePhoneNumberFromString(`+${cleaned}`);
    if (intl?.isValid()) return intl.number;
  }
  return null;
}

/**
 * Mailbox local part for a phone number. Numbers from the deployment's home country use the
 * short national form (9876543210@domain) the brief asks for; foreign numbers keep their
 * country code so two countries can never collide on the same local part.
 */
export function phoneToLocalPart(e164: string, defaultCountry: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed && parsed.country === defaultCountry) return parsed.nationalNumber;
  return e164.replace('+', '');
}

export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

export function splitAddress(address: string): { local: string; domain: string } {
  const at = address.lastIndexOf('@');
  if (at < 0) return { local: address.toLowerCase(), domain: '' };
  return { local: address.slice(0, at).toLowerCase(), domain: address.slice(at + 1).toLowerCase() };
}

/** Accepts a phone number or a full address and returns a canonical lowercase address. */
export function toAddress(input: string, mailDomain: string, defaultCountry: string): string | null {
  const value = input.trim();
  if (value.includes('@')) {
    const { local, domain } = splitAddress(value);
    return local && domain.includes('.') ? `${local}@${domain}` : null;
  }
  const phone = normalizePhone(value, defaultCountry);
  return phone ? `${phoneToLocalPart(phone, defaultCountry)}@${mailDomain}` : null;
}
