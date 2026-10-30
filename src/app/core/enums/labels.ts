import type {
  CampaignType,
  ComponentType,
  DeviceCondition,
  DeviceStatus,
  DispatchBatchStatus,
  DropOffPointType,
  EmploymentType,
  EnrollmentStatus,
  FulfilmentMethod,
  FundTransactionReason,
  FundType,
  Gender,
  Grade,
  HazardousMaterial,
  InstitutionType,
  IntakeChannel,
  IntakeStatus,
  LedgerEventType,
  ListingItemType,
  ListingStatus,
  OrderStatus,
  PayoutMethod,
  PayoutStatus,
  Role,
  SanitizationMethod,
  TransportMode,
} from '../api/types';

/** Value arrays mirror §6 exactly. Labels are the "suggested labels" from the same table. */
export const DEVICE_CONDITIONS: readonly DeviceCondition[] = [
  'Dead',
  'BrokenScreen',
  'WorkingFaulty',
];

export const DEVICE_CONDITION_LABELS: Record<DeviceCondition, string> = {
  Dead: "Dead (won't switch on)",
  BrokenScreen: 'Broken screen',
  WorkingFaulty: 'Working but faulty',
};

export const DROP_OFF_TYPE_LABELS: Record<DropOffPointType, string> = {
  Hub: 'Hub',
  SolarMakit: 'Solar Makit',
  Kiosk: 'Kiosk',
};

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  Cash: 'Cash',
  OrangeMoney: 'Orange Money',
  Afrimoney: 'Afrimoney',
};

export const SANITIZATION_METHOD_LABELS: Record<SanitizationMethod, string> = {
  FactoryResetOverwrite: 'Factory reset + overwrite',
  SamsungKnoxGradeErase: 'Samsung Knox-grade erase',
  CryptographicErase: 'Cryptographic erase',
  StoragePhysicalDestruction: 'Physical storage destruction',
};

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  Received: 'Received',
  Purchased: 'Purchased',
  Sanitized: 'Sanitized',
  SanitizationFailed: 'Wipe failed',
  Refurbishing: 'Refurbishing',
  Dismantled: 'Dismantled',
  Disposed: 'Disposed',
  Listed: 'Listed',
  Sold: 'Sold',
};

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  Pending: 'Pending',
  Scheduled: 'Scheduled',
  Collected: 'Collected',
  Received: 'Received',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
};

export const LEDGER_EVENT_LABELS: Record<LedgerEventType, string> = {
  IntakeCreated: 'Intake created',
  DeviceReceived: 'Received at hub',
  Purchased: 'Purchased',
  Sanitized: 'Data wiped',
  CertificateIssued: 'Certificate issued',
  Dismantled: 'Dismantled',
  ComponentRecovered: 'Component recovered',
  MaterialDiverted: 'Hazardous material diverted',
  Listed: 'Listed for sale',
  Sold: 'Sold',
  Reinvested: 'Reinvested',
};

/** Humanises any PascalCase enum value we don't have a label for. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

// ---------- option lists for filters and forms (values exactly as §6) ----------

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

/** Builds select options; labels default to `humanize(value)`. */
export function options<T extends string>(
  values: readonly T[],
  labels?: Partial<Record<T, string>>,
): Option<T>[] {
  return values.map((value) => ({ value, label: labels?.[value] ?? humanize(value) }));
}

export const INTAKE_STATUSES: readonly IntakeStatus[] = [
  'Pending',
  'Scheduled',
  'Collected',
  'Received',
  'Rejected',
  'Cancelled',
];
export const FULFILMENT_METHODS: readonly FulfilmentMethod[] = ['DropOff', 'Pickup'];
export const FULFILMENT_LABELS: Record<FulfilmentMethod, string> = {
  DropOff: 'Drop-off',
  Pickup: 'Pickup',
};
export const INTAKE_CHANNELS: readonly IntakeChannel[] = [
  'Ussd',
  'Sms',
  'DropOff',
  'AgentPickup',
  'Web',
];
export const CHANNEL_LABELS: Record<IntakeChannel, string> = {
  Ussd: 'USSD',
  Sms: 'SMS',
  DropOff: 'Drop-off',
  AgentPickup: 'Agent pickup',
  Web: 'Web',
};
export const DEVICE_STATUSES: readonly DeviceStatus[] = [
  'Received',
  'Purchased',
  'Sanitized',
  'SanitizationFailed',
  'Refurbishing',
  'Dismantled',
  'Disposed',
  'Listed',
  'Sold',
];
export const PAYOUT_METHODS: readonly PayoutMethod[] = ['Cash', 'OrangeMoney', 'Afrimoney'];
export const PAYOUT_STATUSES: readonly PayoutStatus[] = ['Pending', 'Paid', 'Failed'];
export const TRANSPORT_MODES: readonly TransportMode[] = ['Foot', 'Bicycle', 'Motorcycle'];
export const BATCH_STATUSES: readonly DispatchBatchStatus[] = [
  'Planned',
  'InProgress',
  'Completed',
  'Cancelled',
];
export const LISTING_STATUSES: readonly ListingStatus[] = [
  'Draft',
  'Published',
  'Reserved',
  'Sold',
  'Withdrawn',
];
export const LISTING_ITEM_TYPES: readonly ListingItemType[] = ['RefurbishedDevice', 'Component'];
export const ORDER_STATUSES: readonly OrderStatus[] = ['Pending', 'Paid', 'Fulfilled', 'Cancelled'];
export const GRADES: readonly Grade[] = ['A', 'B', 'C', 'Salvage'];
export const COMPONENT_TYPES: readonly ComponentType[] = [
  'Screen',
  'Board',
  'Battery',
  'Camera',
  'Housing',
  'ChargingPort',
  'Speaker',
  'Other',
];
export const HAZARDOUS_MATERIALS: readonly HazardousMaterial[] = [
  'LithiumBattery',
  'Lead',
  'Other',
];
export const FUND_TYPES: readonly FundType[] = ['SeedFund', 'TrainingFund'];
export const FUND_LABELS: Record<FundType, string> = {
  SeedFund: 'Seed Fund',
  TrainingFund: 'Training Fund',
};
export const FUND_REASONS: readonly FundTransactionReason[] = [
  'Grant',
  'DevicePurchase',
  'Reinvestment',
  'TrainingExpense',
  'Adjustment',
];
/** Manual movements only (§8.15): Grant credits, the others debit. */
export const MANUAL_FUND_REASONS = ['Grant', 'TrainingExpense', 'Adjustment'] as const;
export const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = [
  'Enrolled',
  'Completed',
  'Dropped',
];
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  'FullTime',
  'PartTime',
  'Stipend',
  'Apprenticeship',
];
export const INSTITUTION_TYPES: readonly InstitutionType[] = ['School', 'Campus', 'Community'];
export const CAMPAIGN_TYPES: readonly CampaignType[] = [
  'Talk',
  'Workshop',
  'Radio',
  'CollectionDrive',
  'SocialMedia',
];
export const GENDERS: readonly Gender[] = ['Unspecified', 'Female', 'Male', 'Other'];
export const ROLES: readonly Role[] = [
  'Admin',
  'OperationsLead',
  'Technician',
  'FieldAgent',
  'Buyer',
  'Citizen',
];
export const DROP_OFF_TYPES: readonly DropOffPointType[] = ['Hub', 'SolarMakit', 'Kiosk'];
export const LEDGER_EVENTS: readonly LedgerEventType[] = [
  'IntakeCreated',
  'DeviceReceived',
  'Purchased',
  'Sanitized',
  'CertificateIssued',
  'Dismantled',
  'ComponentRecovered',
  'MaterialDiverted',
  'Listed',
  'Sold',
  'Reinvested',
];
/** `entityType` values for GET /ledger (§8.18). */
export const LEDGER_ENTITY_TYPES = [
  'IntakeRequest',
  'Device',
  'Purchase',
  'SanitizationRecord',
  'Certificate',
  'RecoveredComponent',
  'HazardousMaterialLog',
  'Listing',
  'Order',
] as const;
