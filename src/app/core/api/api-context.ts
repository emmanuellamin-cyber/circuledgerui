import { HttpContext, HttpContextToken } from '@angular/common/http';

/** `auth: false` in the §12 client: no bearer token and no refresh on 401. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export const publicContext = (): HttpContext => new HttpContext().set(SKIP_AUTH, true);
