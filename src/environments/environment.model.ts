export interface AppEnvironment {
  production: boolean;
  /**
   * Origin of the CircuLedger API, without `/api/v1`.
   * Empty string = same origin (used with the `ng serve` proxy, see proxy.conf.json).
   */
  apiBase: string;
  /** Shows the "Demo accounts" helper on the login page. Never enable in production. */
  showDemoAccounts: boolean;
  /** USSD service code shown on the landing page and pre-filled in the simulator. */
  ussdServiceCode: string;
  /** Value for `?token=` on the USSD/SMS webhooks when `Gateway:WebhookToken` is enabled (§8.19). */
  gatewayToken: string | null;
  /**
   * `to` field for the SMS simulator (§8.19 lists the field but not the hub number).
   * Placeholder until the backend confirms the short code; editable in the simulator.
   */
  smsHubNumber: string;
}
