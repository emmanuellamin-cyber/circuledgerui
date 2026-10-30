import { AppEnvironment } from './environment.model';

/**
 * `ng serve` (port 4200). Calls go to the same origin and proxy.conf.json forwards
 * /api, /health and /openapi to http://localhost:5097, so no CORS change is needed.
 */
export const environment: AppEnvironment = {
  production: false,
  apiBase: 'https://circuledger.onrender.com',
  showDemoAccounts: true,
  ussdServiceCode: '*384*1234#',
  gatewayToken: null,
  smsHubNumber: 'CircuLedger',
};
