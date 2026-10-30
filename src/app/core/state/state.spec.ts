import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { throwError, of } from 'rxjs';
import { ApiError } from '../api/api-error';
import { ToastService } from '../../shared/ui/glass-toast';
import { imeiValidator } from '../../features/ops/shared/ops-dialogs';
import { activeNav } from '../../features/ops/ops-nav';
import { useAction } from './action';
import { UrlQuery, urlQuery } from './url-query';

@Component({ template: '' })
class Host {
  readonly q: UrlQuery<{ status: string; search: string }> = urlQuery({ status: '', search: '' });
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('urlQuery', () => {
  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'list', component: Host }])],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(Host);
    return { router, q: fixture.componentInstance.q };
  }

  it('reads filters and page from the URL with defaults', async () => {
    const { q } = await setup('/list?status=Pending&page=3');
    expect(q.value()).toEqual({ status: 'Pending', search: '' });
    expect(q.page()).toBe(3);
  });

  it('writes filters to the URL, resets the page and drops defaults', async () => {
    const { router, q } = await setup('/list?status=Pending&page=3');
    q.set({ search: 'galaxy', status: '' });
    await settle();
    expect(router.url).toBe('/list?search=galaxy');
  });

  it('can keep the page (e.g. selecting a row)', async () => {
    const { router, q } = await setup('/list?page=2');
    q.set({ status: 'Received' }, { keepPage: true });
    await settle();
    expect(router.url).toBe('/list?page=2&status=Received');
  });

  it('treats a bad page number as page 1', async () => {
    const { q } = await setup('/list?page=abc');
    expect(q.page()).toBe(1);
  });
});

describe('useAction', () => {
  function run<T>(fn: (a: ReturnType<typeof useAction>) => Promise<T>) {
    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(() => {
      const action = useAction();
      return { action, done: fn(action), toast: TestBed.inject(ToastService) };
    });
  }

  it('returns the result and toasts success', async () => {
    const { action, done, toast } = run((a) => a.run(of(42), { success: 'Saved' }));
    expect(await done).toBe(42);
    expect(action.busy()).toBe(false);
    expect(toast.toasts()[0].message).toBe('Saved');
  });

  it('shows problem.detail, or the per-code message, inline', async () => {
    const err = new ApiError(409, {
      title: 'Conflict',
      status: 409,
      detail: 'Balance too low.',
      code: 'insufficient_funds',
    });
    const a1 = run((a) => a.run(throwError(() => err)));
    expect(await a1.done).toBeUndefined();
    expect(a1.action.error()).toBe('Balance too low.');

    TestBed.resetTestingModule();
    const a2 = run((a) =>
      a.run(
        throwError(() => err),
        { messages: { insufficient_funds: 'Top up the Seed Fund.' } },
      ),
    );
    await a2.done;
    expect(a2.action.error()).toBe('Top up the Seed Fund.');
  });

  it('maps 400 validation errors onto the form', async () => {
    const form = new FormGroup({ phone: new FormControl('') });
    const err = new ApiError(400, {
      title: 'Invalid',
      status: 400,
      errors: { Phone: ['Enter a valid number.'] },
    });
    const { action, done } = run((a) =>
      a.run(
        throwError(() => err),
        { form },
      ),
    );
    await done;
    expect(form.controls.phone.errors).toEqual({ server: 'Enter a valid number.' });
    expect(action.error()).toBeNull();
  });
});

describe('imeiValidator', () => {
  it('accepts valid IMEIs (Luhn) and ignores spaces/dashes', () => {
    expect(imeiValidator({ value: '352099001761481' })).toBeNull();
    expect(imeiValidator({ value: '49-015420-323751-8' })).toBeNull();
    expect(imeiValidator({ value: '' })).toBeNull();
  });
  it('rejects wrong length and bad check digits', () => {
    expect(imeiValidator({ value: '12345' })).not.toBeNull();
    expect(imeiValidator({ value: '352099001761482' })).not.toBeNull();
  });
});

describe('activeNav', () => {
  it('picks the longest matching item', () => {
    expect(activeNav('/ops/intake/unlocated')?.item.label).toBe('Unlocated pickups');
    expect(activeNav('/ops/intake?status=Pending')?.item.label).toBe('Inbox');
    expect(activeNav('/ops/devices/123')?.item.label).toBe('Register');
    expect(activeNav('/ops')?.item.label).toBe('Home');
  });
});
