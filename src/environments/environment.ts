import { AppEnvironment } from './environment.model';

/** Production / `ng build` defaults: local `dotnet run` API. */
export const environment: AppEnvironment = {
  production: true,
  apiBase: 'https://circuledger.onrender.com',
  showDemoAccounts: false,
  ussdServiceCode: '*384*1234#',
  gatewayToken: null,
  smsHubNumber: 'CircuLedger',
};
