import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-error';
import { ApiService, v1Url } from '../api/api.service';
import type { AuthResponse, UserProfile } from '../api/types';
import { AuthService, REFRESH_KEY } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';
import { problemInterceptor } from './problem.interceptor';

const user: UserProfile = {
  id: 'u1',
  email: 'ops@circuledger.local',
  fullName: 'Aminata Kamara',
  gender: 'Female',
  roles: ['OperationsLead'],
  isActive: true,
  createdAt: '2026-10-30T10:09:15Z',
};

function auth(access: string, refresh: string): AuthResponse {
  return {
    accessToken: access,
    accessTokenExpiresAt: '2026-10-30T10:39:43Z',
    refreshToken: refresh,
    refreshTokenExpiresAt: '2026-11-13T10:09:43Z',
    user,
  };
}

/** Lets promise continuations (refresh → retry) run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('authInterceptor (single-flight refresh)', () => {
  let http: HttpTestingController;
  let api: ApiService;
  let session: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApiService);
    session = TestBed.inject(AuthService);
    session.setSession(auth('access-1', 'refresh-1'));
  });

  afterEach(() => http.verify());

  it('attaches the bearer token to API calls', async () => {
    const p = firstValueFrom(api.get('/devices'));
    const req = http.expectOne(v1Url('/devices'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({ items: [] });
    await p;
  });

  it('does not attach a token to public calls', async () => {
    const p = firstValueFrom(api.get('/public/drop-off-points', { auth: false }));
    const req = http.expectOne(v1Url('/public/drop-off-points'));
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
    await p;
  });

  it('refreshes ONCE for parallel 401s and retries every request with the new token', async () => {
    const a = firstValueFrom(api.get<string>('/devices'));
    const b = firstValueFrom(api.get<string>('/orders'));
    const c = firstValueFrom(api.get<string>('/funds'));

    for (const path of ['/devices', '/orders', '/funds']) {
      http.expectOne(v1Url(path)).flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    const refreshes = http.match(v1Url('/auth/refresh'));
    expect(refreshes.length).toBe(1);
    expect(refreshes[0].request.body).toEqual({ refreshToken: 'refresh-1' });
    refreshes[0].flush(auth('access-2', 'refresh-2'));
    await settle();

    for (const path of ['/devices', '/orders', '/funds']) {
      const retry = http.expectOne(v1Url(path));
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
      retry.flush(path);
    }
    expect(await Promise.all([a, b, c])).toEqual(['/devices', '/orders', '/funds']);
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-2');
    http.expectNone(v1Url('/auth/refresh'));
  });

  it('retries a late 401 with the already-rotated token instead of refreshing again', async () => {
    const early = firstValueFrom(api.get<string>('/devices'));
    const late = firstValueFrom(api.get<string>('/orders'));
    const lateReq = http.expectOne(v1Url('/orders'));

    http.expectOne(v1Url('/devices')).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(v1Url('/auth/refresh')).flush(auth('access-2', 'refresh-2'));
    await settle();
    http.expectOne(v1Url('/devices')).flush('ok');
    await early;

    // This one was sent with access-1 before the refresh and only fails now.
    lateReq.flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();
    http.expectNone(v1Url('/auth/refresh'));
    const retry = http.expectOne(v1Url('/orders'));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush('ok');
    expect(await late).toBe('ok');
  });

  it('clears the session and surfaces an ApiError when the refresh fails', async () => {
    const p = firstValueFrom(api.get('/devices'));
    http.expectOne(v1Url('/devices')).flush(null, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne(v1Url('/auth/refresh'))
      .flush({ title: 'Unauthorized', status: 401 }, { status: 401, statusText: 'Unauthorized' });

    const error = await p.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(session.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('never refreshes for public endpoints', async () => {
    const p = firstValueFrom(api.post('/auth/login', {}, { auth: false })).catch((e: unknown) => e);
    http
      .expectOne(v1Url('/auth/login'))
      .flush(
        { title: 'Unauthorized', status: 401, detail: 'Invalid email or password.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    const error = (await p) as ApiError;
    expect(error.message).toBe('Invalid email or password.');
    http.expectNone(v1Url('/auth/refresh'));
  });
});
