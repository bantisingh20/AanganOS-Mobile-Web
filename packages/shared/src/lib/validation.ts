/**
 * Common validation helpers for contact phone and email.
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const INDIAN_PHONE_REGEX = /^(\+91)?[6-9]\d{9}$/;

export function validateEmail(email?: string | null, required = false): string | null {
  const val = (email ?? '').trim();
  if (!val) {
    return required ? 'Email address is required' : null;
  }
  if (!EMAIL_REGEX.test(val)) {
    return 'Please enter a valid email address (e.g. name@domain.com)';
  }
  return null;
}

export function validatePhone(phone?: string | null, required = true): string | null {
  const val = (phone ?? '').trim();
  if (!val) {
    return required ? 'Phone number is required' : null;
  }
  // Strip non-digits except leading +
  const digits = val.replace(/\D/g, '');
  if (val.startsWith('+91') || digits.length === 10) {
    const raw10 = digits.slice(-10);
    if (!/^[6-9]\d{9}$/.test(raw10)) {
      return 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9';
    }
    return null;
  }
  if (digits.length < 8 || digits.length > 15) {
    return 'Please enter a valid phone number';
  }
  return null;
}
