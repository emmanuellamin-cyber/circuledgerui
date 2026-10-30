import { expect, test } from '@playwright/test';

/**
 * §10 step 1 + 2: a citizen sells a phone over USSD (simulator → real POST /ussd/callback),
 * then an Operations Lead finds the intake request by its reference code.
 * Menu text is never asserted (it comes from the API); only the protocol and the reference are.
 */
const OPS_EMAIL = process.env['E2E_OPS_EMAIL'] ?? 'ops@circuledger.local';
const OPS_PASSWORD = process.env['E2E_OPS_PASSWORD'] ?? 'ChangeMe!Demo2026';
/** "" → 1 → 1*1 → 1*1*2 → 1*1*2*2 → 1*1*2*2*Towama → 1*1*2*2*Towama*1 */
const HOPS = ['1', '1', '2', '2', 'Towama', '1'];

test('dial the USSD code, get a reference, find it in the Ops intake inbox', async ({ page }) => {
  // Unique phone per run so earlier runs don't interfere.
  const phone = `+2327${String(Date.now()).slice(-7)}`;

  await page.goto('/demo/ussd');
  await page.getByLabel('Phone number').fill(phone);

  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/ussd/callback'))
      sent.push(new URLSearchParams(r.postData() ?? '').get('text') ?? '');
  });

  await page.getByRole('button', { name: 'Call' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  for (const hop of HOPS) {
    const reply = page.getByLabel('Reply');
    await expect(reply).toBeVisible();
    await reply.fill(hop);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    // Either the next prompt or the final message appears.
    await expect(page.locator('#ussd-msg, #ussd-end').first()).toBeVisible({ timeout: 15_000 });
    if (await page.locator('#ussd-end').isVisible()) break;
  }

  expect(sent.slice(0, 3)).toEqual(['', '1', '1*1']);
  const end = page.locator('#ussd-end');
  await expect(end).toBeVisible();
  const ref = (await end.locator('mark').first().textContent())?.trim();
  expect(ref, 'END message should contain a highlighted reference code').toMatch(
    /^[A-Z0-9]{6,12}$/,
  );

  // Ops logs in and finds it.
  await page.goto('/login');
  await page.getByLabel('Email').fill(OPS_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(OPS_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/ops/);

  await page.goto(`/ops/intake?referenceCode=${ref}`);
  const row = page.getByRole('row', { name: new RegExp(ref!) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText('Pending');
});
