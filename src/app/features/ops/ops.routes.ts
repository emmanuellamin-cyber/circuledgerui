import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/guards';
import { POLICY } from '../../core/auth/roles';

/** Operations workspace (Admin, OperationsLead). Every screen follows the §9 A map. */
export const OPS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ops-shell').then((m) => m.OpsShell),
    children: [
      {
        path: '',
        title: 'Operations · CircuLedger',
        loadComponent: () => import('./home/ops-home').then((m) => m.OpsHome),
      },
      {
        path: 'reports',
        title: 'Reports · CircuLedger',
        loadComponent: () => import('./reports/ops-reports').then((m) => m.OpsReports),
      },
      {
        path: 'intake',
        title: 'Intake inbox · CircuLedger',
        loadComponent: () => import('./intake/intake-inbox').then((m) => m.IntakeInbox),
      },
      {
        path: 'intake/unlocated',
        title: 'Unlocated pickups · CircuLedger',
        loadComponent: () => import('./intake/unlocated-pickups').then((m) => m.UnlocatedPickups),
      },
      {
        path: 'dispatch',
        title: 'Dispatch planner · CircuLedger',
        loadComponent: () => import('./dispatch/dispatch-planner').then((m) => m.DispatchPlanner),
      },
      {
        path: 'devices',
        title: 'Devices · CircuLedger',
        loadComponent: () => import('./devices/devices-list').then((m) => m.DevicesList),
      },
      {
        path: 'devices/:id',
        title: 'Device · CircuLedger',
        loadComponent: () => import('./devices/device-detail').then((m) => m.DeviceDetail),
      },
      {
        path: 'purchase',
        title: 'Purchase desk · CircuLedger',
        loadComponent: () => import('./purchase/purchase-desk').then((m) => m.PurchaseDesk),
      },
      {
        path: 'certificates',
        title: 'Certificates · CircuLedger',
        loadComponent: () => import('./certificates/certificates').then((m) => m.CertificatesList),
      },
      {
        path: 'certificates/:certificateNumber',
        title: 'Certificate · CircuLedger',
        loadComponent: () => import('./certificates/certificates').then((m) => m.CertificateDetail),
      },
      {
        path: 'ledger',
        title: 'Ledger explorer · CircuLedger',
        loadComponent: () => import('./ledger/ledger-explorer').then((m) => m.LedgerExplorer),
      },
      {
        path: 'listings',
        title: 'Listings · CircuLedger',
        loadComponent: () => import('./listings/listings-list').then((m) => m.ListingsList),
      },
      {
        path: 'listings/:id',
        title: 'Listing · CircuLedger',
        loadComponent: () => import('./listings/listing-detail').then((m) => m.ListingDetail),
      },
      {
        path: 'orders',
        title: 'Orders · CircuLedger',
        loadComponent: () => import('./orders/orders').then((m) => m.OpsOrders),
      },
      {
        path: 'funds',
        title: 'Funds · CircuLedger',
        loadComponent: () => import('./funds/funds').then((m) => m.OpsFunds),
      },
      {
        path: 'pricing',
        title: 'Pricing · CircuLedger',
        loadComponent: () => import('./pricing/pricing').then((m) => m.OpsPricing),
      },
      {
        path: 'training',
        title: 'Training & jobs · CircuLedger',
        loadComponent: () => import('./people/training').then((m) => m.OpsTraining),
      },
      {
        path: 'awareness',
        title: 'Awareness · CircuLedger',
        loadComponent: () => import('./people/awareness').then((m) => m.OpsAwareness),
      },
      {
        path: 'hazardous',
        title: 'Hazardous materials · CircuLedger',
        loadComponent: () => import('./people/hazardous').then((m) => m.OpsHazardous),
      },
      {
        path: 'users',
        title: 'Users · CircuLedger',
        canActivate: [roleGuard(POLICY.Admin)],
        loadComponent: () => import('./admin/users').then((m) => m.OpsUsers),
      },
      {
        path: 'drop-off-points',
        title: 'Drop-off points · CircuLedger',
        loadComponent: () => import('./admin/drop-off-points').then((m) => m.OpsDropOffPoints),
      },
      {
        path: 'tools/ussd',
        title: 'USSD simulator · CircuLedger',
        data: { mode: 'ops' },
        loadComponent: () =>
          import('../tools/ussd-simulator/ussd-simulator-page').then((m) => m.UssdSimulatorPage),
      },
      { path: '**', redirectTo: '/404' },
    ],
  },
];
