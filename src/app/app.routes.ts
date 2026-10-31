import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/guards';
import { POLICY } from './core/auth/roles';

const ussdSimulator = () =>
  import('./features/tools/ussd-simulator/ussd-simulator-page').then((m) => m.UssdSimulatorPage);

export const routes: Routes = [
  // Operations has its own shell (sidebar), so it sits outside the public shell.
  {
    path: 'ops',
    canActivate: [roleGuard(POLICY.Ops)],
    loadChildren: () => import('./features/ops/ops.routes').then((m) => m.OPS_ROUTES),
  },
  // Workshop and Field moved to the Flutter app (circuledger_mobile); old links land on its info page.
  { path: 'workshop', redirectTo: '/mobile-app', pathMatch: 'prefix' },
  { path: 'field', redirectTo: '/mobile-app', pathMatch: 'prefix' },
  {
    path: '',
    loadComponent: () => import('./layout/public-shell').then((m) => m.PublicShell),
    children: [
      {
        path: '',
        title: 'CircuLedger · Smart Youth Mobile Circularity Hub',
        loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
      },
      {
        path: 'verify',
        title: 'Verify a certificate · CircuLedger',
        loadComponent: () =>
          import('./features/public/verify-certificate/verify-page').then((m) => m.VerifyPage),
      },
      {
        path: 'verify/:certificateNumber',
        title: 'Verify a certificate · CircuLedger',
        loadComponent: () =>
          import('./features/public/verify-certificate/verify-page').then((m) => m.VerifyPage),
      },
      {
        path: 'login',
        title: 'Log in · CircuLedger',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
      },
      {
        path: 'register',
        title: 'Create an account · CircuLedger',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register').then((m) => m.Register),
      },
      {
        path: 'design-system',
        title: 'Design system · CircuLedger',
        loadComponent: () =>
          import('./features/design-system/design-system').then((m) => m.DesignSystem),
      },

      {
        path: 'demo/ussd',
        title: 'USSD simulator · CircuLedger',
        data: { mode: 'demo' },
        loadComponent: ussdSimulator,
      },

      // Workspaces inside the public shell. Ops has its own shell above.
      {
        path: 'mobile-app',
        title: 'Mobile app · CircuLedger',
        loadComponent: () =>
          import('./features/mobile-app/mobile-app-page').then((m) => m.MobileAppPage),
      },
      {
        // Public browsing; cart is client-side; checkout and "My orders" need the Buyer policy.
        path: 'marketplace',
        loadComponent: () =>
          import('./features/marketplace/marketplace-shell').then((m) => m.MarketplaceShell),
        children: [
          {
            path: '',
            title: 'Marketplace · CircuLedger',
            loadComponent: () =>
              import('./features/marketplace/browse').then((m) => m.MarketplaceBrowse),
          },
          {
            path: 'listing/:id',
            title: 'Item · Marketplace · CircuLedger',
            loadComponent: () =>
              import('./features/marketplace/product').then((m) => m.MarketplaceProduct),
          },
          {
            path: 'cart',
            title: 'Cart · CircuLedger',
            loadComponent: () =>
              import('./features/marketplace/cart').then((m) => m.MarketplaceCart),
          },
          {
            path: 'orders',
            title: 'My orders · CircuLedger',
            canActivate: [roleGuard(POLICY.Buyer)],
            loadComponent: () => import('./features/marketplace/my-orders').then((m) => m.MyOrders),
          },
          {
            path: 'orders/:id',
            title: 'Order · CircuLedger',
            canActivate: [roleGuard(POLICY.Buyer)],
            loadComponent: () => import('./features/marketplace/my-orders').then((m) => m.MyOrder),
          },
        ],
      },
      {
        path: 'citizen',
        title: 'My phones · CircuLedger',
        canActivate: [roleGuard(POLICY.Citizen)],
        loadComponent: () => import('./features/citizen/citizen').then((m) => m.CitizenHome),
      },

      {
        // Every role manages its own profile here (PROFILE_MANAGEMENT.md).
        path: 'profile',
        title: 'My profile · CircuLedger',
        canActivate: [authGuard],
        loadComponent: () => import('./features/account/profile').then((m) => m.ProfilePage),
      },

      {
        path: '403',
        title: 'Not allowed · CircuLedger',
        loadComponent: () => import('./features/errors/forbidden').then((m) => m.Forbidden),
      },
      {
        path: '**',
        title: 'Page not found · CircuLedger',
        loadComponent: () => import('./features/errors/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
