import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { v1Url } from '../../../core/api/api.service';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { problemInterceptor } from '../../../core/http/problem.interceptor';
import {
  buildCurl,
  extractCodes,
  historyText,
  isServiceCode,
  parseOptions,
  parseUssdResponse,
  segmentMessage,
  suggestsText,
} from './ussd-logic';
import { CONNECTION_PROBLEM, UssdSessionStore } from './ussd-session.store';

describe('USSD protocol helpers', () => {
  it('joins the whole input history with "*"', () => {
    expect(historyText([])).toBe('');
    expect(historyText(['1'])).toBe('1');
    expect(historyText(['1', '1', '2', '2', 'Towama', '1'])).toBe('1*1*2*2*Towama*1');
  });

  it('strips the 4-character CON / END prefix', () => {
    expect(parseUssdResponse('CON Smart Youth Circularity Hub\n1. Sell a phone')).toEqual({
      kind: 'CON',
      message: 'Smart Youth Circularity Hub\n1. Sell a phone',
    });
    expect(parseUssdResponse('END Thank you! Ref: SY56JDVN')).toEqual({
      kind: 'END',
      message: 'Thank you! Ref: SY56JDVN',
    });
  });

  it('treats an unexpected response as final so the session cannot hang', () => {
    expect(parseUssdResponse('Internal error').kind).toBe('END');
  });

  it('parses numbered options without assuming any menu text', () => {
    expect(parseOptions('Choose brand\n1. Samsung\n2) Tecno\n 10 - Other\nnot an option')).toEqual([
      { key: '1', label: 'Samsung' },
      { key: '2', label: 'Tecno' },
      { key: '10', label: 'Other' },
    ]);
  });

  it('suggests QWERTY for name / area / code prompts and numeric for menus', () => {
    expect(suggestsText('Type your area or landmark:')).toBe(true);
    expect(suggestsText('Enter your reference code')).toBe(true);
    expect(suggestsText('Enter certificate number')).toBe(true);
    expect(suggestsText('Condition\n1. Dead\n2. Broken screen\n3. Working but faulty')).toBe(false);
    // Words inside option lines don't count.
    expect(suggestsText('Choose drop-off\n1. Kiosk Bo/Kowama landmark')).toBe(false);
  });

  it('finds reference codes and certificate numbers', () => {
    expect(extractCodes('Thank you! Ref: SY56JDVN')).toEqual([
      { type: 'reference', value: 'SY56JDVN' },
    ]);
    expect(extractCodes('Valid: CDS-2026-000045 (Samsung). Ref SYABC234')).toEqual([
      { type: 'certificate', value: 'CDS-2026-000045' },
      { type: 'reference', value: 'SYABC234' },
    ]);
    expect(extractCodes('Enter your reference number please')).toEqual([]);
  });

  it('splits a message into highlighted segments', () => {
    const codes = extractCodes('Thank you! Ref: SY56JDVN.');
    expect(segmentMessage('Thank you! Ref: SY56JDVN.', codes)).toEqual([
      { text: 'Thank you! Ref: ' },
      { text: 'SY56JDVN', code: { type: 'reference', value: 'SY56JDVN' } },
      { text: '.' },
    ]);
  });

  it('validates service codes', () => {
    expect(isServiceCode('*384*1234#')).toBe(true);
    expect(isServiceCode('*384#')).toBe(true);
    expect(isServiceCode('384')).toBe(false);
    expect(isServiceCode('*#06#')).toBe(false);
  });

  it('builds a copyable curl command', () => {
    expect(buildCurl('http://x/api/v1/ussd/callback', { text: "1*it's" })).toContain(
      `--data-urlencode 'text=1*it'\\''s'`,
    );
  });
});

describe('UssdSessionStore', () => {
  let http: HttpTestingController;
  let store: UssdSessionStore;
  const url = v1Url('/ussd/callback');
  const body = (r: TestRequest) => new URLSearchParams(r.request.body as string);
  const settle = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        UssdSessionStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(UssdSessionStore);
  });

  afterEach(() => http.verify());

  async function reply(expectedText: string, raw: string): Promise<URLSearchParams> {
    const req = http.expectOne(url);
    const form = body(req);
    expect(form.get('text')).toBe(expectedText);
    req.flush(raw);
    await settle();
    return form;
  }

  it('walks the §10 hops, sending the whole history each time', async () => {
    void store.dial();
    const first = await reply('', 'CON Menu\n1. Sell');
    expect(first.get('serviceCode')).toBe('*384*1234#');
    expect(first.get('phoneNumber')).toBe('+23276123456');
    expect(first.get('sessionId')).toBe(store.sessionId());
    expect(http.match(url)).toEqual([]);
    expect(store.screen()).toBe('dialog');

    const entries = ['1', '1', '2', '2', 'Towama', '1'];
    const expected = ['1', '1*1', '1*1*2', '1*1*2*2', '1*1*2*2*Towama', '1*1*2*2*Towama*1'];
    for (let i = 0; i < entries.length; i++) {
      store.input.set(entries[i]);
      void store.send();
      const last = i === entries.length - 1;
      const form = await reply(expected[i], last ? 'END Thank you! Ref: SY56JDVN' : 'CON Next');
      expect(form.get('sessionId')).toBe(first.get('sessionId'));
    }

    expect(store.screen()).toBe('end');
    expect(store.message()).toBe('Thank you! Ref: SY56JDVN');
    expect(store.codes()).toEqual([{ type: 'reference', value: 'SY56JDVN' }]);
    expect(store.log().length).toBe(7);
    expect(store.log()[0].kind).toBe('END');
  });

  it('sends form-encoded bodies without a bearer token', async () => {
    void store.dial();
    const req = http.expectOne(url);
    expect(req.request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush('END Bye');
    await settle();
  });

  it('does not send empty replies', async () => {
    void store.dial();
    await reply('', 'CON Enter area');
    store.input.set('   ');
    await store.send();
    http.expectNone(url);
  });

  it('shows the phone "connection problem" message on network errors and 429', async () => {
    void store.dial();
    http.expectOne(url).flush('slow down', { status: 429, statusText: 'Too Many Requests' });
    await settle();
    expect(store.screen()).toBe('error');
    expect(store.message()).toContain(CONNECTION_PROBLEM);
    expect(store.log()[0].kind).toBe('ERROR');
    expect(store.log()[0].status).toBe(429);
  });

  it('rejects a dialled code that is not a service code without calling the API', async () => {
    store.dialed.set('12345');
    await store.dial();
    http.expectNone(url);
    expect(store.screen()).toBe('error');
  });

  it('ignores a late response from an abandoned session', async () => {
    void store.dial();
    const stale = http.expectOne(url);
    store.newSession();
    stale.flush('CON Old menu');
    await settle();
    expect(store.screen()).toBe('dialer');
    expect(store.message()).toBe('');
  });
});
