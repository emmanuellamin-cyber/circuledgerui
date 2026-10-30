// Copied verbatim from FRONTEND_INTEGRATION_GUIDE.md §11. They mirror the API exactly.
// Optional request fields are marked `?`. Do not add fields that are not in the guide.

// ---------- common ----------
export type Guid = string;
export type IsoDateTime = string; // "2026-10-30T09:20:00Z"
export type IsoDate = string;     // "2026-10-30"

export interface Paged<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number; }

export interface ProblemDetails {
  type?: string; title: string; status: number; detail?: string; instance?: string;
  code?: string; traceId?: string; errors?: Record<string, string[]>;
}

// ---------- enums ----------
export type Role = "Admin" | "OperationsLead" | "Technician" | "FieldAgent" | "Buyer" | "Citizen";
export type Gender = "Unspecified" | "Female" | "Male" | "Other";
export type DropOffPointType = "Hub" | "SolarMakit" | "Kiosk";
export type IntakeChannel = "Ussd" | "Sms" | "DropOff" | "AgentPickup" | "Web";
export type FulfilmentMethod = "DropOff" | "Pickup";
export type DeviceCondition = "Dead" | "BrokenScreen" | "WorkingFaulty";
export type IntakeStatus = "Pending" | "Scheduled" | "Collected" | "Received" | "Rejected" | "Cancelled";
export type TransportMode = "Foot" | "Bicycle" | "Motorcycle";
export type DispatchBatchStatus = "Planned" | "InProgress" | "Completed" | "Cancelled";
export type DeviceStatus = "Received" | "Purchased" | "Sanitized" | "SanitizationFailed" | "Refurbishing"
  | "Dismantled" | "Disposed" | "Listed" | "Sold";
export type PayoutMethod = "Cash" | "OrangeMoney" | "Afrimoney";
export type PayoutStatus = "Pending" | "Paid" | "Failed";
export type SanitizationMethod = "FactoryResetOverwrite" | "SamsungKnoxGradeErase" | "CryptographicErase" | "StoragePhysicalDestruction";
export type SanitizationOutcome = "Passed" | "Failed" | "NotEligible";
export type RecoveryOutcome = "Refurbish" | "DismantleForParts" | "HazardousDisposalOnly";
export type ComponentType = "Screen" | "Board" | "Battery" | "Camera" | "Housing" | "ChargingPort" | "Speaker" | "Other";
export type Grade = "A" | "B" | "C" | "Salvage";
export type ComponentStatus = "InStock" | "Listed" | "Sold" | "Scrapped";
export type HazardousMaterial = "LithiumBattery" | "Lead" | "Other";
export type ListingItemType = "RefurbishedDevice" | "Component";
export type ListingStatus = "Draft" | "Published" | "Reserved" | "Sold" | "Withdrawn";
export type OrderStatus = "Pending" | "Paid" | "Fulfilled" | "Cancelled";
export type FundType = "SeedFund" | "TrainingFund";
export type FundTransactionDirection = "Credit" | "Debit";
export type FundTransactionReason = "Grant" | "DevicePurchase" | "Reinvestment" | "TrainingExpense" | "Adjustment";
export type EnrollmentStatus = "Enrolled" | "Completed" | "Dropped";
export type EmploymentType = "FullTime" | "PartTime" | "Stipend" | "Apprenticeship";
export type InstitutionType = "School" | "Campus" | "Community";
export type CampaignType = "Talk" | "Workshop" | "Radio" | "CollectionDrive" | "SocialMedia";
export type LedgerEventType = "IntakeCreated" | "DeviceReceived" | "Purchased" | "Sanitized" | "CertificateIssued"
  | "Dismantled" | "ComponentRecovered" | "MaterialDiverted" | "Listed" | "Sold" | "Reinvested";

// ---------- auth & users ----------
export interface UserProfile { id: string; email: string; fullName: string; gender: Gender; roles: Role[]; isActive: boolean; createdAt: IsoDateTime; }
export interface AuthResponse { accessToken: string; accessTokenExpiresAt: IsoDateTime; refreshToken: string; refreshTokenExpiresAt: IsoDateTime; user: UserProfile; }
export interface RegisterRequest { email: string; password: string; fullName: string; gender?: Gender; accountType?: "Buyer" | "Citizen"; phone?: string | null; }
export interface LoginRequest { email: string; password: string; }
export interface CreateUserRequest { email: string; password: string; fullName: string; gender: Gender; roles: Role[]; }

// ---------- drop-off points ----------
export interface DropOffPoint { id: Guid; name: string; type: DropOffPointType; latitude: number; longitude: number; landmark: string | null; openingHours: string; isActive: boolean; displayOrder: number; }
export type UpsertDropOffPoint = Omit<DropOffPoint, "id">;

// ---------- intake ----------
export interface IntakeRequest {
  id: Guid; referenceCode: string; citizenPhoneMasked: string; brand: string; model: string | null;
  reportedCondition: DeviceCondition; channel: IntakeChannel; fulfilmentMethod: FulfilmentMethod;
  dropOffPointId: Guid | null; dropOffPointName: string | null; pickupArea: string | null;
  pickupLatitude: number | null; pickupLongitude: number | null; estimatedOfferSle: number | null;
  status: IntakeStatus; dispatchBatchId: Guid | null; createdAt: IsoDateTime; scheduledAt: IsoDateTime | null;
  collectedAt: IsoDateTime | null; receivedAt: IsoDateTime | null; closedReason: string | null; deviceTrackingId: string | null;
}
export interface CreateIntakeRequest {
  phone: string; brand: string; model?: string | null; condition: DeviceCondition; fulfilmentMethod: FulfilmentMethod;
  dropOffPointId?: Guid | null; pickupArea?: string | null; pickupLatitude?: number | null; pickupLongitude?: number | null; channel?: IntakeChannel;
}
export interface ReceiveIntakeRequest { dropOffPointId: Guid; imei?: string | null; brand?: string | null; model?: string | null; assessedCondition?: DeviceCondition | null; }
export interface WalkInIntakeRequest { phone: string; brand: string; model?: string | null; imei?: string | null; condition: DeviceCondition; dropOffPointId: Guid; }

// ---------- dispatch ----------
export interface BatchPickup { intakeRequestId: Guid; referenceCode: string; brand: string; condition: DeviceCondition; pickupArea: string | null; latitude: number | null; longitude: number | null; status: IntakeStatus; citizenPhoneMasked: string; collectedAt: IsoDateTime | null; }
export interface DispatchBatch { id: Guid; batchCode: string; fieldAgentUserId: string; fieldAgentName: string | null; transportMode: TransportMode; status: DispatchBatchStatus; centroidLatitude: number; centroidLongitude: number; radiusKm: number; spreadKm: number; scheduledFor: IsoDate; pickups: BatchPickup[]; }
export interface GenerateBatchesRequest { radiusKm?: number; maxPerBatch?: number; fieldAgentIds?: string[]; transportMode?: TransportMode; scheduledFor?: IsoDate; }
export interface GenerateBatchesResult { batches: DispatchBatch[]; requestsBatched: number; unlocatedRequests: number; }
export interface PickupContact { intakeRequestId: Guid; referenceCode: string; phone: string; pickupArea: string | null; }

// ---------- devices & purchasing ----------
export interface DevicePurchaseSummary { paidPriceSle: number; payoutMethod: PayoutMethod; payoutStatus: PayoutStatus; purchasedAt: IsoDateTime; }
export interface Device {
  id: Guid; trackingId: string; brand: string; model: string | null; maskedImei: string; condition: DeviceCondition;
  isSamsungFlagship: boolean; intakeChannel: IntakeChannel; status: DeviceStatus; recoveryOutcome: RecoveryOutcome | null;
  locationId: Guid | null; locationName: string | null; intakeReference: string | null; certificateNumber: string | null;
  purchase: DevicePurchaseSummary | null; createdAt: IsoDateTime;
}
export interface PurchaseDeviceRequest { payoutMethod: PayoutMethod; agreedPriceSle?: number | null; payoutReference?: string | null; }
export interface Purchase { id: Guid; deviceId: Guid; trackingId: string; offeredPriceSle: number; paidPriceSle: number; payoutMethod: PayoutMethod; payoutStatus: PayoutStatus; payoutReference: string | null; payoutCompletedAt: IsoDateTime | null; createdAt: IsoDateTime; }
export interface PricingRule { id: Guid; brand: string; condition: DeviceCondition; priceSle: number; isActive: boolean; }
export interface PriceQuote { brand: string; condition: DeviceCondition; priceSle: number | null; matchedBrand: string; }

// ---------- sanitization & certificates ----------
export interface Certificate { id: Guid; certificateNumber: string; deviceId: Guid; trackingId: string; issuedAt: IsoDateTime; payloadHash: string; signatureAlgorithm: string; signingKeyId: string; verificationUrl: string; isRevoked: boolean; revokedAt: IsoDateTime | null; revocationReason: string | null; }
export interface RecordSanitizationRequest { method: SanitizationMethod; startedAt: IsoDateTime; completedAt: IsoDateTime; passes: number; outcome: SanitizationOutcome; toolName?: string | null; notes?: string | null; }
export interface SanitizationRecord { id: Guid; deviceId: Guid; trackingId: string; method: SanitizationMethod; technicianUserId: string; startedAt: IsoDateTime; completedAt: IsoDateTime; passes: number; outcome: SanitizationOutcome; toolName: string | null; notes: string | null; certificate: Certificate | null; }
export interface PublicCertificateVerification { certificateNumber: string; isValid: boolean; status: "Valid" | "Invalid" | "Revoked" | "NotFound"; issuedAt: IsoDateTime | null; issuer: string | null; device: string | null; maskedImei: string | null; method: SanitizationMethod | null; passes: number | null; payloadHash: string | null; reason: string | null; }

// ---------- recovery ----------
export interface Component { id: Guid; componentCode: string; deviceId: Guid; trackingId: string; brand: string; type: ComponentType; grade: Grade; status: ComponentStatus; notes: string | null; createdAt: IsoDateTime; }
export interface LogHazardousMaterialRequest { deviceId?: Guid | null; material: HazardousMaterial; description?: string | null; weightKg: number; storageLocation: string; isSwollenBattery: boolean; }
export interface HazardousMaterialLog { id: Guid; deviceId: Guid | null; trackingId: string | null; material: HazardousMaterial; description: string | null; weightKg: number; storageLocation: string; isSwollenBattery: boolean; handledByUserId: string; loggedAt: IsoDateTime; }
export interface HazardousSummary { totalKg: number; lithiumKg: number; leadKg: number; otherKg: number; swollenBatteries: number; }

// ---------- marketplace ----------
export interface ListingPhoto { id: Guid; url: string; contentType: string; sizeBytes: number; sha256: string; uploadedAt: IsoDateTime; isVerified: boolean; verifiedAt: IsoDateTime | null; }
export interface Listing { id: Guid; listingCode: string; itemType: ListingItemType; title: string; description: string | null; brand: string; model: string | null; isSamsung: boolean; componentType: ComponentType | null; priceSle: number; condition: Grade; warrantyDays: number; status: ListingStatus; publishedAt: IsoDateTime | null; certificateNumber: string | null; certificateVerificationUrl: string | null; photos: ListingPhoto[]; }
export interface CreateListingRequest { itemType: ListingItemType; deviceId?: Guid | null; componentId?: Guid | null; title: string; description?: string | null; priceSle: number; condition: Grade; warrantyDays: number; }
export interface ListingSearchQuery { search?: string; brand?: string; itemType?: ListingItemType; componentType?: ComponentType; condition?: Grade; minPrice?: number; maxPrice?: number; samsungOnly?: boolean; status?: ListingStatus; sort?: "newest" | "price_asc" | "price_desc"; page?: number; pageSize?: number; }
export interface OrderItem { listingId: Guid; listingCode: string; title: string; priceSle: number; certificateNumber: string | null; }
export interface ReinvestmentSummary { saleTotalSle: number; seedFundSle: number; trainingFundSle: number; totalReinvestedSle: number; }
export interface Order { id: Guid; orderNumber: string; buyerUserId: string; status: OrderStatus; totalSle: number; paymentMethod: string | null; paymentReference: string | null; createdAt: IsoDateTime; paidAt: IsoDateTime | null; fulfilledAt: IsoDateTime | null; cancelledAt: IsoDateTime | null; cancellationReason: string | null; items: OrderItem[]; reinvestment: ReinvestmentSummary | null; }

// ---------- funds ----------
export interface Fund { id: Guid; type: FundType; name: string; balanceSle: number; }
export interface FundTransaction { id: Guid; fundType: FundType; direction: FundTransactionDirection; amountSle: number; balanceAfterSle: number; reason: FundTransactionReason; referenceType: string; referenceId: string; occurredAt: IsoDateTime; description: string | null; }
export interface FundsOverview { funds: Fund[]; totalPurchasesSle: number; totalReinvestedSle: number; totalGrantsSle: number; transactions: Paged<FundTransaction>; }
export interface FundMovementRequest { fund: FundType; reason: "Grant" | "TrainingExpense" | "Adjustment"; amountSle: number; description: string; }
export interface ReinvestmentRule { id: Guid; name: string; seedFundPercent: number; trainingFundPercent: number; totalPercent: number; isActive: boolean; effectiveFrom: IsoDateTime; }

// ---------- people ----------
export interface TrainingCycle { id: Guid; name: string; focus: string | null; location: string | null; startDate: IsoDate; endDate: IsoDate | null; enrolledCount: number; completedCount: number; safetyCertifiedCount: number; }
export interface TraineeEnrollment { id: Guid; trainingCycleId: Guid; userId: string | null; fullName: string; gender: Gender; status: EnrollmentStatus; safetyTrainingCompleted: boolean; safetyTrainingCompletedAt: IsoDateTime | null; completedAt: IsoDateTime | null; }
export interface EmploymentRecord { id: Guid; userId: string | null; fullName: string; gender: Gender; jobTitle: string; employmentType: EmploymentType; startDate: IsoDate; endDate: IsoDate | null; }
export interface AwarenessCampaign { id: Guid; institutionName: string; institutionType: InstitutionType; campaignType: CampaignType; date: IsoDate; reachCount: number; location: string | null; notes: string | null; }

// ---------- dashboard & ledger ----------
export interface TargetMetric { actual: number; target: number; percentOfTarget: number; }
export interface DashboardKpis {
  generatedAt: IsoDateTime; devicesCollected: TargetMetric; intakeRequestsOpen: number; certificatesIssued: number;
  percentSanitized: number; hazardousKgDiverted: TargetMetric; techniciansTrained: TargetMetric; jobsCreated: TargetMetric;
  schoolsReached: TargetMetric; campusesReached: TargetMetric; awarenessPeopleReached: number; devicePurchasesSle: number;
  marketplaceRevenueSle: number; ordersPaid: number; totalReinvestedSle: number; seedFundBalanceSle: number;
  trainingFundBalanceSle: number; samsungSharePercent: number; womenTraineesPercent: number; womenHiresPercent: number;
  womenInclusionTargetPercent: number; componentsRecovered: number; refurbishedDevicesSold: number;
}
export interface TimeSeriesPoint { weekStart: IsoDate; count: number; value: number; }
export interface LedgerEntry { sequenceNumber: number; entityType: string; entityId: string; trackingId: string | null; eventType: LedgerEventType; payload: Record<string, unknown>; timestamp: IsoDateTime; actor: string; previousHash: string; hash: string; }
export interface DeviceHistory { trackingId: string; brand: string; model: string | null; status: DeviceStatus; events: LedgerEntry[]; }
export interface LedgerVerification { isValid: boolean; entriesChecked: number; firstBrokenSequence: number | null; reason: string | null; lastHash: string | null; }
