import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiService } from './api.service';
import type { AuthResponse, UserProfile } from './types';
import type {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ChangePhoneRequest,
  UpdateProfileRequest,
} from './types.extra';

/**
 * "My profile" (PROFILE_MANAGEMENT.md). Every call acts on the signed-in user and replaces the
 * cached user (header, avatar, `cl.user`) with the profile the API returns.
 */
@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  async get(): Promise<UserProfile> {
    return this.cache(await firstValueFrom(this.api.get<UserProfile>('/users/me')));
  }

  async update(body: UpdateProfileRequest): Promise<UserProfile> {
    return this.cache(await firstValueFrom(this.api.put<UserProfile>('/users/me', body)));
  }

  async changeEmail(body: ChangeEmailRequest): Promise<UserProfile> {
    return this.cache(await firstValueFrom(this.api.put<UserProfile>('/users/me/email', body)));
  }

  async changePhone(body: ChangePhoneRequest): Promise<UserProfile> {
    return this.cache(await firstValueFrom(this.api.put<UserProfile>('/users/me/phone', body)));
  }

  /** Signs the user out on every other device. Stores BOTH new tokens, or this session dies too. */
  async changePassword(body: ChangePasswordRequest): Promise<UserProfile> {
    const auth = await firstValueFrom(this.api.put<AuthResponse>('/users/me/password', body));
    this.auth.setSession(auth);
    return auth.user;
  }

  private cache(profile: UserProfile): UserProfile {
    this.auth.updateUser(profile);
    return profile;
  }
}
