import type { ValidationErrors } from '@angular/forms';

/** Human message for the first error on a control. `server` comes from ProblemDetails (§3). */
export function firstErrorMessage(
  errors: ValidationErrors | null,
  label: string,
  custom: Record<string, string> = {},
): string | null {
  if (!errors) return null;
  const [key, value] = Object.entries(errors)[0] as [string, unknown];
  if (custom[key]) return custom[key];
  switch (key) {
    case 'server':
      return String(value);
    case 'required':
      return `${label} is required.`;
    case 'email':
      return 'Enter a valid email address.';
    case 'minlength':
      return `${label} must be at least ${(value as { requiredLength: number }).requiredLength} characters.`;
    case 'maxlength':
      return `${label} must be at most ${(value as { requiredLength: number }).requiredLength} characters.`;
    case 'min':
      return `${label} must be at least ${(value as { min: number }).min}.`;
    case 'max':
      return `${label} must be at most ${(value as { max: number }).max}.`;
    default:
      return typeof value === 'string' ? value : `${label} is not valid.`;
  }
}
