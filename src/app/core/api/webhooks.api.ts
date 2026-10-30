import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService, Query } from './api.service';
import type { SmsInboundReply } from './types.extra';

export interface UssdCallbackFields {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  /** The WHOLE input history joined by "*" ("" → "1" → "1*1" …). */
  text: string;
}

export interface SmsInboundFields {
  from: string;
  text: string;
  to: string;
  id: string;
  date: string;
}

export const USSD_PATH = '/ussd/callback';
export const SMS_PATH = '/sms/inbound';

/** `?token=` when the backend enables `Gateway:WebhookToken` (§8.19). */
export function gatewayQuery(): Query {
  return { token: environment.gatewayToken };
}

/**
 * The telecom-gateway webhooks (§8.19), used only by the simulators. Public, form-encoded,
 * rate limit 300/min per IP.
 */
@Injectable({ providedIn: 'root' })
export class WebhooksApi {
  private readonly api = inject(ApiService);

  /** Plain-text response starting with "CON " or "END ". */
  ussd(fields: UssdCallbackFields): Observable<string> {
    return this.api.postFormText(USSD_PATH, { ...fields }, { auth: false, query: gatewayQuery() });
  }

  sms(fields: SmsInboundFields): Observable<SmsInboundReply> {
    return this.api.postForm<SmsInboundReply>(
      SMS_PATH,
      { ...fields },
      { auth: false, query: gatewayQuery() },
    );
  }
}
