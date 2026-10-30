import { AppEnvironment } from './environment.model';

/** `ng build --configuration docker`: API from docker compose. */
export const environment: AppEnvironment = {
  production: true,
  apiBase: 'https://circuledger.onrender.com',
  showDemoAccounts: false,
  ussdServiceCode: '*384*1234#',
  gatewayToken: null,
  smsHubNumber: 'CircuLedger',
};
