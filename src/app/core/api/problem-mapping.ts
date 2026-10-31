import type { FormGroup } from '@angular/forms';
import { ApiError } from './api-error';

export interface MappedProblem {
  /** camelCase field name → joined message, only for fields the form knows about. */
  fields: Record<string, string>;
  /** Messages that don't belong to a known field (`$.condition`, `request`, unknown keys). */
  general: string[];
}

/**
 * Identity error codes that the API returns as keys instead of property names
 * (§8.1 / §8.2: `DuplicateEmail`, `PasswordRequiresUpper`, …).
 */
export const IDENTITY_ALIASES: Readonly<Record<string, string>> = {
  duplicateEmail: 'email',
  duplicateUserName: 'email',
  invalidEmail: 'email',
  invalidUserName: 'email',
  passwordTooShort: 'password',
  passwordRequiresUpper: 'password',
  passwordRequiresLower: 'password',
  passwordRequiresDigit: 'password',
  passwordRequiresNonAlphanumeric: 'password',
  passwordRequiresUniqueChars: 'password',
};

/** "PriceSle" → "priceSle" (§3). */
export function camelKey(key: string): string {
  return key.charAt(0).toLowerCase() + key.slice(1);
}

/**
 * Maps a validation `errors` object onto form field names.
 * @param knownFields the form's control names; keys not in this list go to `general`.
 */
export function mapProblemErrors(
  errors: Record<string, string[]> | undefined,
  knownFields: readonly string[],
  aliases: Readonly<Record<string, string>> = IDENTITY_ALIASES,
): MappedProblem {
  const out: MappedProblem = { fields: {}, general: [] };
  for (const [rawKey, messages] of Object.entries(errors ?? {})) {
    const text = messages.join(' ');
    if (rawKey === '' || rawKey === 'request' || rawKey.startsWith('$')) {
      out.general.push(text);
      continue;
    }
    // Nested keys like "Items[0].Price" map onto their first segment.
    const first = camelKey(rawKey.split(/[.[]/)[0]);
    const field = aliases[first] ?? first;
    if (knownFields.includes(field)) {
      out.fields[field] = out.fields[field] ? `${out.fields[field]} ${text}` : text;
    } else {
      out.general.push(text);
    }
  }
  return out;
}

/**
 * Applies an `ApiError` to a reactive form: sets `{ server: message }` on matching controls
 * and returns the message(s) to show as a general form error.
 */
export function applyProblemToForm(
  form: FormGroup,
  error: ApiError,
  aliases: Readonly<Record<string, string>> = IDENTITY_ALIASES,
): string[] {
  if (Object.keys(error.fieldErrors).length === 0) {
    return [error.message];
  }
  const mapped = mapProblemErrors(error.fieldErrors, Object.keys(form.controls), aliases);
  for (const [name, message] of Object.entries(mapped.fields)) {
    const control = form.get(name);
    control?.setErrors({ ...(control.errors ?? {}), server: message });
    control?.markAsTouched();
  }
  return mapped.general;
}
