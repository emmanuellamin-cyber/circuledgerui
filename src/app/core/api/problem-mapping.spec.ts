import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { ApiError, toApiError } from './api-error';
import { applyProblemToForm, camelKey, mapProblemErrors } from './problem-mapping';

describe('ProblemDetails mapping', () => {
  it('lower-cases the first letter of PascalCase keys', () => {
    expect(camelKey('PriceSle')).toBe('priceSle');
    expect(camelKey('DropOffPointId')).toBe('dropOffPointId');
  });

  it('maps known fields and sends JSON-path / unknown keys to general errors', () => {
    const mapped = mapProblemErrors(
      {
        Phone: ['Enter a valid Sierra Leone phone number.'],
        Imei: ['IMEI must be 15 digits with a valid check digit.'],
        '$.condition': ['The JSON value could not be converted.'],
        request: ['The request field is required.'],
        Unknown: ['Something else.'],
      },
      ['phone', 'imei'],
    );
    expect(mapped.fields).toEqual({
      phone: 'Enter a valid Sierra Leone phone number.',
      imei: 'IMEI must be 15 digits with a valid check digit.',
    });
    expect(mapped.general).toEqual([
      'The JSON value could not be converted.',
      'The request field is required.',
      'Something else.',
    ]);
  });

  it('maps Identity codes (DuplicateEmail, PasswordRequiresUpper) onto email/password', () => {
    const mapped = mapProblemErrors(
      { DuplicateEmail: ['Email is already taken.'], PasswordRequiresUpper: ['Needs upper case.'] },
      ['email', 'password'],
    );
    expect(mapped.fields).toEqual({
      email: 'Email is already taken.',
      password: 'Needs upper case.',
    });
  });

  it('joins multiple messages and uses the first segment of nested keys', () => {
    const mapped = mapProblemErrors({ 'ListingIds[0]': ['Bad id.', 'Unknown.'] }, ['listingIds']);
    expect(mapped.fields).toEqual({ listingIds: 'Bad id. Unknown.' });
  });

  it('applies server errors to form controls and returns the rest', () => {
    const form = new FormGroup({ phone: new FormControl(''), brand: new FormControl('') });
    const err = new ApiError(400, {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { Phone: ['Enter a valid Sierra Leone phone number.'], '$.condition': ['Bad enum.'] },
    });
    expect(applyProblemToForm(form, err)).toEqual(['Bad enum.']);
    expect(form.controls.phone.errors).toEqual({
      server: 'Enter a valid Sierra Leone phone number.',
    });
    expect(form.controls.phone.touched).toBe(true);
    expect(form.controls.brand.errors).toBeNull();
  });

  it('returns the detail when there is no errors object', () => {
    const form = new FormGroup({ x: new FormControl('') });
    const err = new ApiError(409, {
      title: 'Insufficient funds',
      status: 409,
      detail: 'Balance too low.',
      code: 'insufficient_funds',
    });
    expect(applyProblemToForm(form, err)).toEqual(['Balance too low.']);
  });
});

describe('toApiError', () => {
  const res = (status: number, error: unknown) =>
    new HttpErrorResponse({ status, statusText: 'X', error, headers: new HttpHeaders() });

  it('keeps code, detail and traceId from a ProblemDetails body', () => {
    const e = toApiError(
      res(409, {
        title: 'Insufficient funds',
        status: 409,
        detail: 'Too low.',
        code: 'insufficient_funds',
        traceId: 't-1',
      }),
    );
    expect(e.status).toBe(409);
    expect(e.code).toBe('insufficient_funds');
    expect(e.message).toBe('Too low.');
    expect(e.traceId).toBe('t-1');
  });

  it('parses a JSON string body (blob downloads)', () => {
    const e = toApiError(res(404, '{"title":"Not found","status":404,"code":"not_found"}'));
    expect(e.code).toBe('not_found');
  });

  it('gives network failures and 429s a readable message', () => {
    expect(toApiError(res(0, null)).code).toBe('network_error');
    expect(toApiError(res(429, null)).message).toMatch(/too many requests/i);
  });
});
