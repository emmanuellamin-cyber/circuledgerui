import type { Role } from '../api/types';

/** Used when a user has several roles (Admin wins). */
export const ROLE_PRIORITY: readonly Role[] = [
  'Admin',
  'OperationsLead',
  'Technician',
  'FieldAgent',
  'Buyer',
  'Citizen',
];

/** Policy groups from §2. The UI mirrors them; the API enforces them. */
export const POLICY = {
  Ops: ['Admin', 'OperationsLead'],
  Workshop: ['Admin', 'OperationsLead', 'Technician'],
  Field: ['Admin', 'OperationsLead', 'FieldAgent'],
  Staff: ['Admin', 'OperationsLead', 'Technician', 'FieldAgent'],
  Buyer: ['Buyer', 'Admin', 'OperationsLead'],
  Admin: ['Admin'],
  Citizen: ['Citizen'],
} as const satisfies Record<string, readonly Role[]>;

export const ROLE_LABELS: Record<Role, string> = {
  Admin: 'Administrator',
  OperationsLead: 'Operations lead',
  Technician: 'Technician',
  FieldAgent: 'Field agent',
  Buyer: 'Buyer',
  Citizen: 'Citizen',
};

/**
 * Web workspaces. Workshop (Technician) and Field (FieldAgent) live in the separate Flutter app
 * `circuledger_mobile`; on the web those roles get the "mobile" info page instead.
 */
export type WorkspaceId = 'ops' | 'mobile' | 'marketplace' | 'citizen';

export interface Workspace {
  id: WorkspaceId;
  label: string;
  description: string;
  path: string;
  /** Roles allowed to open it. Matches the API policy group the screens rely on. */
  roles: readonly Role[];
}

export const WORKSPACES: readonly Workspace[] = [
  {
    id: 'ops',
    label: 'Operations',
    description: 'KPIs, intake, devices, commerce',
    path: '/ops',
    roles: POLICY.Ops,
  },
  {
    id: 'mobile',
    label: 'Mobile app',
    description: 'Workshop and Field tools',
    path: '/mobile-app',
    roles: ['Technician', 'FieldAgent'],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    description: 'Shop and my orders',
    path: '/marketplace',
    roles: POLICY.Buyer,
  },
  {
    id: 'citizen',
    label: 'My phones',
    description: 'My sell requests',
    path: '/citizen',
    roles: POLICY.Citizen,
  },
];

/** Each role's own home workspace. */
const HOME_OF: Record<Role, WorkspaceId> = {
  Admin: 'ops',
  OperationsLead: 'ops',
  Technician: 'mobile',
  FieldAgent: 'mobile',
  Buyer: 'marketplace',
  Citizen: 'citizen',
};

export function hasAnyRole(roles: readonly Role[], allowed: readonly Role[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

/** Highest-priority role, or null for a user with no known roles. */
export function primaryRole(roles: readonly Role[]): Role | null {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
}

export function workspaceById(id: WorkspaceId): Workspace {
  return WORKSPACES.find((w) => w.id === id) as Workspace;
}

/** The workspace a user lands in after login: Admin > OperationsLead > … > Citizen. */
export function primaryWorkspace(roles: readonly Role[]): Workspace | null {
  const role = primaryRole(roles);
  return role ? workspaceById(HOME_OF[role]) : null;
}

/** Path to redirect to after login. Users without a known role go to the landing page. */
export function homePathFor(roles: readonly Role[]): string {
  return primaryWorkspace(roles)?.path ?? '/';
}

/** Every workspace the user can open, primary first (for the profile-menu switcher). */
export function workspacesFor(roles: readonly Role[]): Workspace[] {
  const primary = primaryWorkspace(roles);
  const all = WORKSPACES.filter((w) => hasAnyRole(roles, w.roles));
  return primary ? [primary, ...all.filter((w) => w.id !== primary.id)] : all;
}

/** Only same-app absolute paths are allowed as a post-login return URL. */
export function safeReturnUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/login')) return null;
  return url;
}
