import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import type { Role } from '../api/types';
import { AuthService } from './auth.service';
import { guestGuard, roleGuard } from './guards';
import { POLICY } from './roles';

function signIn(roles: Role[]): void {
  TestBed.inject(AuthService).setSession({
    accessToken: 't',
    accessTokenExpiresAt: '',
    refreshToken: 'r',
    refreshTokenExpiresAt: '',
    user: {
      id: '1',
      email: 'a@b.c',
      fullName: 'A B',
      gender: 'Unspecified',
      roles,
      isActive: true,
      createdAt: '',
    },
  });
}

function run(guard: ReturnType<typeof roleGuard>, url: string): boolean | UrlTree {
  return TestBed.runInInjectionContext(
    () => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot) as boolean | UrlTree,
  );
}

const serialize = (r: boolean | UrlTree) =>
  r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r;

describe('roleGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('sends signed-out users to /login with a return URL', () => {
    expect(serialize(run(roleGuard(POLICY.Ops), '/ops/devices?status=Sanitized'))).toBe(
      '/login?returnUrl=%2Fops%2Fdevices%3Fstatus%3DSanitized',
    );
  });

  it('lets a user with an allowed role in', () => {
    signIn(['OperationsLead']);
    expect(run(roleGuard(POLICY.Ops), '/ops')).toBe(true);
  });

  it('sends a signed-in user without the role to the 403 page', () => {
    signIn(['Technician']);
    expect(serialize(run(roleGuard(POLICY.Ops), '/ops'))).toBe('/403?from=%2Fops');
  });

  it('mirrors the API policy groups (Admin and Ops leads can buy, a Citizen cannot)', () => {
    signIn(['Admin']);
    expect(run(roleGuard(POLICY.Buyer), '/marketplace/orders')).toBe(true);
    signIn(['Citizen']);
    expect(serialize(run(roleGuard(POLICY.Buyer), '/marketplace/orders'))).toBe(
      '/403?from=%2Fmarketplace%2Forders',
    );
  });

  it('accepts any one of several roles', () => {
    signIn(['Technician', 'Buyer']);
    expect(run(roleGuard(POLICY.Buyer), '/marketplace/orders')).toBe(true);
  });
});

describe('guestGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('allows signed-out users onto /login', () => {
    expect(run(guestGuard, '/login')).toBe(true);
  });

  it('sends a signed-in user to their workspace', () => {
    signIn(['FieldAgent']);
    expect(serialize(run(guestGuard, '/login'))).toBe('/mobile-app');
  });
});
