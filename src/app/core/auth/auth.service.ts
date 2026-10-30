import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, v1Url } from '../api/api.service';
import type { AuthResponse, LoginRequest, RegisterRequest, Role, UserProfile } from '../api/types';
import { hasAnyRole, primaryWorkspace, workspacesFor } from './roles';

export const REFRESH_KEY = 'cl.refresh';
export const USER_KEY = 'cl.user';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredUser(): UserProfile | null {
  try {
    const raw = storage()?.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

/**
 * Session state (§2, port of the §12 client).
 * - The access token lives in memory only (a signal).
 * - The refresh token and the user profile survive reloads in localStorage.
 * - `refreshOnce()` is SINGLE-FLIGHT: concurrent callers share one in-flight promise, so the
 *   same refresh token is never sent twice (a reuse revokes every session of the user).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  /** Bypasses the interceptors so a refresh can never trigger another refresh. */
  private readonly rawHttp = new HttpClient(inject(HttpBackend));

  private readonly token = signal<string | null>(null);
  private readonly profile = signal<UserProfile | null>(null);
  private refreshPromise: Promise<boolean> | null = null;

  readonly user = this.profile.asReadonly();
  readonly roles = computed<readonly Role[]>(() => this.profile()?.roles ?? []);
  readonly isAuthenticated = computed(() => this.token() !== null && this.profile() !== null);
  readonly primaryWorkspace = computed(() => primaryWorkspace(this.roles()));
  readonly workspaces = computed(() => workspacesFor(this.roles()));

  accessToken(): string | null {
    return this.token();
  }

  hasRole(...allowed: Role[]): boolean {
    return hasAnyRole(this.roles(), allowed);
  }

  setSession(auth: AuthResponse): void {
    this.token.set(auth.accessToken);
    this.profile.set(auth.user);
    storage()?.setItem(REFRESH_KEY, auth.refreshToken);
    storage()?.setItem(USER_KEY, JSON.stringify(auth.user));
  }

  clearSession(): void {
    this.token.set(null);
    this.profile.set(null);
    storage()?.removeItem(REFRESH_KEY);
    storage()?.removeItem(USER_KEY);
  }

  /** Only one refresh at a time. Reusing a refresh token logs the user out everywhere. */
  refreshOnce(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = storage()?.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const auth = await firstValueFrom(
        this.rawHttp.post<AuthResponse>(v1Url('/auth/refresh'), { refreshToken }),
      );
      this.setSession(auth);
      return true;
    } catch (e: unknown) {
      // A network failure keeps the refresh token so the next attempt can succeed.
      const status = (e as { status?: number }).status ?? 0;
      if (status !== 0) this.clearSession();
      return false;
    }
  }

  /** On app start: restore the session silently (access tokens live in memory only). */
  restoreSession(): Promise<boolean> {
    if (!storage()?.getItem(REFRESH_KEY)) {
      storage()?.removeItem(USER_KEY);
      return Promise.resolve(false);
    }
    // Show the stored profile immediately; the refresh replaces it with the server copy.
    this.profile.set(readStoredUser());
    return this.refreshOnce().then((ok) => {
      if (!ok && !this.token()) this.profile.set(null);
      return ok;
    });
  }

  async login(body: LoginRequest): Promise<UserProfile> {
    const auth = await firstValueFrom(
      this.api.post<AuthResponse>('/auth/login', body, { auth: false }),
    );
    this.setSession(auth);
    return auth.user;
  }

  async register(body: RegisterRequest): Promise<UserProfile> {
    const auth = await firstValueFrom(
      this.api.post<AuthResponse>('/auth/register', body, { auth: false }),
    );
    this.setSession(auth);
    return auth.user;
  }

  /** §2 rule 4: tell the API, then clear storage. Always succeeds locally. */
  async logout(redirectTo = '/'): Promise<void> {
    const refreshToken = storage()?.getItem(REFRESH_KEY);
    this.clearSession();
    if (refreshToken) {
      try {
        await firstValueFrom(
          this.api.post<void>('/auth/logout', { refreshToken }, { auth: false }),
        );
      } catch {
        // 204 always; a network error is fine to ignore here.
      }
    }
    await this.router.navigateByUrl(redirectTo);
  }

  /** Called by the interceptor when a refresh fails: clear and send to login. */
  sessionExpired(): void {
    const wasSignedIn = this.profile() !== null;
    this.clearSession();
    if (!wasSignedIn) return;
    const returnUrl = this.router.url;
    void this.router.navigate(['/login'], { queryParams: { returnUrl, reason: 'expired' } });
  }
}
