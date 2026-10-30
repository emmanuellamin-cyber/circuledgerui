import {
  Banknote,
  Coins,
  FileText,
  GraduationCap,
  HandCoins,
  House,
  Inbox,
  LinkIcon,
  LucideIconData,
  MapPin,
  MapPinOff,
  Megaphone,
  Package,
  ReceiptText,
  Route,
  ShieldCheck,
  Smartphone,
  Store,
  TriangleAlert,
  Users,
} from 'lucide-angular';
import type { Role } from '../../core/api/types';
import { POLICY } from '../../core/auth/roles';

export interface OpsNavItem {
  label: string;
  path: string;
  icon: LucideIconData;
  /** Extra words the command palette matches on. */
  keywords?: string;
  /** Hidden for users without one of these roles (UX only; the route is guarded too). */
  roles?: readonly Role[];
  exact?: boolean;
}

export interface OpsNavGroup {
  label: string;
  items: OpsNavItem[];
}

/** Sidebar and command palette share this list. Each screen follows the §9 A endpoint map. */
export const OPS_NAV: readonly OpsNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Home', path: '/ops', icon: House, keywords: 'kpis dashboard targets', exact: true },
      { label: 'Reports', path: '/ops/reports', icon: FileText, keywords: 'csv export m&e' },
    ],
  },
  {
    label: 'Intake',
    items: [
      {
        label: 'Inbox',
        path: '/ops/intake',
        icon: Inbox,
        keywords: 'intake requests walk-in receive',
        exact: true,
      },
      {
        label: 'Unlocated pickups',
        path: '/ops/intake/unlocated',
        icon: MapPinOff,
        keywords: 'location gps coordinates',
      },
      {
        label: 'Dispatch planner',
        path: '/ops/dispatch',
        icon: Route,
        keywords: 'batches field agents pickup',
      },
    ],
  },
  {
    label: 'Devices',
    items: [
      {
        label: 'Register',
        path: '/ops/devices',
        icon: Smartphone,
        keywords: 'devices tracking imei',
      },
      {
        label: 'Purchase desk',
        path: '/ops/purchase',
        icon: HandCoins,
        keywords: 'buy payout seed fund',
      },
      {
        label: 'Certificates',
        path: '/ops/certificates',
        icon: ShieldCheck,
        keywords: 'sanitization pdf qr revoke',
      },
      {
        label: 'Ledger explorer',
        path: '/ops/ledger',
        icon: LinkIcon,
        keywords: 'hash chain integrity audit',
      },
    ],
  },
  {
    label: 'Commerce',
    items: [
      {
        label: 'Listings',
        path: '/ops/listings',
        icon: Store,
        keywords: 'marketplace photos publish',
      },
      { label: 'Orders', path: '/ops/orders', icon: ReceiptText, keywords: 'pay fulfil cancel' },
      {
        label: 'Funds & reinvestment',
        path: '/ops/funds',
        icon: Coins,
        keywords: 'seed training grant rule',
      },
      {
        label: 'Pricing',
        path: '/ops/pricing',
        icon: Banknote,
        keywords: 'matrix brand condition price',
      },
    ],
  },
  {
    label: 'People & impact',
    items: [
      {
        label: 'Training & jobs',
        path: '/ops/training',
        icon: GraduationCap,
        keywords: 'cohort enrollment safety employment',
      },
      {
        label: 'Awareness',
        path: '/ops/awareness',
        icon: Megaphone,
        keywords: 'schools campuses campaigns',
      },
      {
        label: 'Hazardous materials',
        path: '/ops/hazardous',
        icon: TriangleAlert,
        keywords: 'battery lithium lead kg',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Users',
        path: '/ops/users',
        icon: Users,
        keywords: 'staff roles accounts',
        roles: POLICY.Admin,
      },
      {
        label: 'Drop-off points',
        path: '/ops/drop-off-points',
        icon: MapPin,
        keywords: 'hub kiosk solar makit',
      },
    ],
  },
  {
    label: 'Tools',
    items: [
      {
        label: 'USSD simulator',
        path: '/ops/tools/ussd',
        icon: Package,
        keywords: 'sms demo phone',
      },
    ],
  },
];

/** Longest nav path that prefixes `url`, with its group. */
export function activeNav(url: string): { group: OpsNavGroup; item: OpsNavItem } | null {
  const path = url.split(/[?#]/)[0];
  let best: { group: OpsNavGroup; item: OpsNavItem } | null = null;
  for (const group of OPS_NAV) {
    for (const item of group.items) {
      const hit = item.exact
        ? path === item.path
        : path === item.path || path.startsWith(`${item.path}/`);
      if (hit && (!best || item.path.length > best.item.path.length)) best = { group, item };
    }
  }
  return best;
}
