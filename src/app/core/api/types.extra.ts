// Request/response shapes that are documented by JSON examples in FRONTEND_INTEGRATION_GUIDE.md
// but are not part of the §11 type block. Each one cites its section. Nothing here is invented.
import type {
  ComponentType,
  DeviceCondition,
  EmploymentType,
  EnrollmentStatus,
  Gender,
  Grade,
  PayoutStatus,
  RecoveryOutcome,
  Role,
} from './types';

/** §8.20 `GET /health` */
export type HealthStatus = 'Healthy' | 'Degraded' | 'Unhealthy';
export interface HealthReport {
  status: HealthStatus;
  durationMs: number;
  checks: { name: string; status: HealthStatus; description: string | null }[];
}

/** §8.19 `POST /sms/inbound` response */
export interface SmsInboundReply {
  keyword: string;
  reply: string;
}

/** §8.3 `GET /public/certificates/signing-key` */
export interface SigningKey {
  keyId: string;
  algorithm: string;
  publicKeyPem: string;
}

/** §8.1 `POST /auth/refresh`, `POST /auth/logout` */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** §8.2 `PUT /users/me` */
export interface UpdateProfileRequest {
  fullName: string;
  gender: Gender;
}
/** `PUT /users/me/email` (PROFILE_MANAGEMENT.md) */
export interface ChangeEmailRequest {
  newEmail: string;
  currentPassword: string;
}
/** `PUT /users/me/phone` */
export interface ChangePhoneRequest {
  phone: string;
  currentPassword: string;
}
/** `PUT /users/me/password`: returns new tokens. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
/** §8.2 `PUT /users/{id}/roles` */
export interface UpdateRolesRequest {
  roles: Role[];
}

/** §8.5 cancel / reject, §8.11 revoke, §8.14 cancel */
export interface ReasonRequest {
  reason: string;
}

/** §8.5 `PUT /intake-requests/{id}/pickup-location` */
export interface SetPickupLocationRequest {
  latitude: number;
  longitude: number;
  pickupArea?: string | null;
}

/** §8.8 `PUT /devices/{id}/purchase/payout` */
export interface UpdatePayoutRequest {
  status: PayoutStatus;
  payoutReference?: string | null;
}

/** §8.9 `PUT /pricing/matrix` */
export interface UpsertPricingRule {
  brand: string;
  condition: DeviceCondition;
  priceSle: number;
  isActive: boolean;
}

/** §8.12 */
export interface RecoveryOutcomeRequest {
  outcome: RecoveryOutcome;
}
export interface DismantleRequest {
  notes?: string | null;
}
export interface AddComponentRequest {
  type: ComponentType;
  grade: Grade;
  notes?: string | null;
}

/** §8.13 `PUT /listings/{id}` */
export interface UpdateListingRequest {
  title: string;
  description?: string | null;
  priceSle: number;
  condition: Grade;
  warrantyDays: number;
}

/** §8.14 */
export interface CreateOrderRequest {
  listingIds: string[];
}
export interface PayOrderRequest {
  paymentMethod: string;
  paymentReference?: string | null;
}

/** §8.15 `PUT /reinvestment-rule` */
export interface UpdateReinvestmentRuleRequest {
  name: string;
  seedFundPercent: number;
  trainingFundPercent: number;
}

/** §8.16 */
export interface CreateTrainingCycleRequest {
  name: string;
  focus?: string | null;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
}
export interface CreateEnrollmentRequest {
  fullName: string;
  gender: Gender;
  userId?: string | null;
}
export interface UpdateEnrollmentRequest {
  status: EnrollmentStatus;
  safetyTrainingCompleted: boolean;
}
export interface CreateEmploymentRequest {
  fullName: string;
  gender: Gender;
  jobTitle: string;
  employmentType: EmploymentType;
  startDate: string;
  endDate?: string | null;
  userId?: string | null;
}
