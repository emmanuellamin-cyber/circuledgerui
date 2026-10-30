import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { v1Url } from '../../../core/api/api.service';
import { problemInterceptor } from '../../../core/http/problem.interceptor';
import { KeyFeedback } from '../phone/key-feedback';
import { UssdScreen } from './ussd-screen';
import { UssdSessionStore } from './ussd-session.store';

describe('UssdScreen', () => {
  const url = v1Url('/ussd/callback');
  const settle = () => new Promise((r) => setTimeout(r, 0));

  function setup() {
    TestBed.configureTestingModule({
      imports: [UssdScreen],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemInterceptor])),
        provideHttpClientTesting(),
        UssdSessionStore,
        KeyFeedback,
      ],
    });
    const fixture = TestBed.createComponent(UssdScreen);
    const http = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(UssdSessionStore);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, http, store, el };
  }

  const click = (el: HTMLElement, selector: string) =>
    (el.querySelector(selector) as HTMLButtonElement).click();

  it('dials from the keypad, shows the spinner, then renders the server menu verbatim', async () => {
    const { fixture, http, store, el } = setup();
    await fixture.whenStable();

    for (const k of ['*', '3', '8', '4', '#']) click(el, `.dkey[aria-label="${k}"]`);
    expect(store.dialed()).toBe('*384#');
    click(el, '.call');
    await fixture.whenStable();
    expect(el.textContent).toContain('USSD code running');

    const menu = 'Any menu text\n1. First\n2. Second';
    const req = http.expectOne(url);
    expect(new URLSearchParams(req.request.body as string).get('serviceCode')).toBe('*384#');
    req.flush(`CON ${menu}`);
    await settle();
    await fixture.whenStable();

    expect(el.querySelector('#ussd-msg')?.textContent).toBe(menu);
    const send = el.querySelector('.act.strong') as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    const input = el.querySelector('.reply') as HTMLInputElement;
    input.value = '2';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(send.disabled).toBe(false);
    send.click();
    const next = http.expectOne(url);
    expect(new URLSearchParams(next.request.body as string).get('text')).toBe('2');
    next.flush('END Thank you! Ref: SY56JDVN');
    await settle();
    await fixture.whenStable();

    expect(el.querySelector('mark')?.textContent).toBe('SY56JDVN');
    click(el, '.act.strong');
    await fixture.whenStable();
    expect(store.screen()).toBe('dialer');
    http.verify();
  });
});
