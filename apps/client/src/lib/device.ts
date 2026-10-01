const DEVICE_PHONE_KEY = 'dialox.device.phone';

/**
 * Browsers cannot read the SIM's number. The mobile client instead "detects" the number of the
 * virtual device configured in the telephony simulator (same origin, shared storage), or the
 * number last used on this device.
 */
export function detectedPhone(): string | null {
  try {
    return localStorage.getItem(DEVICE_PHONE_KEY);
  } catch {
    return null;
  }
}

export function rememberDevicePhone(phone: string) {
  try {
    localStorage.setItem(DEVICE_PHONE_KEY, phone);
  } catch {
    // Non-essential convenience only.
  }
}

type OtpCredential = Credential & { code: string };

/** WebOTP API (Android Chrome): resolves with the code from an SMS ending in "@host #code". */
export async function listenForWebOtp(signal: AbortSignal): Promise<string | null> {
  if (!('OTPCredential' in window)) return null;
  try {
    const credential = (await navigator.credentials.get({
      otp: { transport: ['sms'] },
      signal,
    } as CredentialRequestOptions)) as OtpCredential | null;
    return credential?.code ?? null;
  } catch {
    return null;
  }
}

interface ContactsManager {
  select(props: string[], options: { multiple: boolean }): Promise<{ tel?: string[]; name?: string[] }[]>;
}

export const contactPickerSupported = () => 'contacts' in navigator && 'ContactsManager' in window;

/** Contact Picker API: lets the user choose a phone number from their device contacts. */
export async function pickContactPhone(): Promise<string | null> {
  const contacts = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  if (!contacts) return null;
  const [picked] = await contacts.select(['tel'], { multiple: false });
  return picked?.tel?.[0] ?? null;
}
