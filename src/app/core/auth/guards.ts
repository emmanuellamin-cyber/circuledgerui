import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { Role } from '../api/types';
import { AuthService } from './auth.service';
import { hasAnyRole, homePathFor } from './roles';

/**
 * Protects a workspace. Signed-out users go to /login (with a return URL); signed-in users
 * without one of the roles go to the friendly 403 page. This is UX only: the API still
 * returns 403 for anything the role can't do.
 */
export function roleGuard(allowed: readonly Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }
    return hasAnyRole(auth.roles(), allowed)
      ? true
      : router.createUrlTree(['/403'], { queryParams: { from: state.url } });
  };
}

/** Any signed-in user, whatever their role (e.g. "My profile"). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** For /login and /register: a signed-in user is sent to their workspace instead. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).parseUrl(homePathFor(auth.roles())) : true;
};
