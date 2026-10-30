import { homePathFor, primaryRole, primaryWorkspace, safeReturnUrl, workspacesFor } from './roles';

describe('role → workspace resolver', () => {
  it.each([
    [['Admin'], '/ops'],
    [['OperationsLead'], '/ops'],
    // Workshop and Field are in the Flutter app; on the web these roles get its info page.
    [['Technician'], '/mobile-app'],
    [['FieldAgent'], '/mobile-app'],
    [['Buyer'], '/marketplace'],
    [['Citizen'], '/citizen'],
  ] as const)('%j lands on %s', (roles, path) => {
    expect(homePathFor(roles)).toBe(path);
  });

  it('uses the priority Admin > OperationsLead > Technician > FieldAgent > Buyer > Citizen', () => {
    expect(primaryRole(['Citizen', 'Buyer', 'FieldAgent'])).toBe('FieldAgent');
    expect(primaryRole(['Buyer', 'Technician'])).toBe('Technician');
    expect(primaryRole(['Citizen', 'Admin'])).toBe('Admin');
    expect(homePathFor(['Citizen', 'Buyer'])).toBe('/marketplace');
  });

  it('falls back to the landing page for users without a known role', () => {
    expect(homePathFor([])).toBe('/');
    expect(primaryWorkspace([])).toBeNull();
  });

  it('lists every workspace a multi-role user can open, primary first', () => {
    expect(workspacesFor(['Buyer', 'Technician']).map((w) => w.id)).toEqual([
      'mobile',
      'marketplace',
    ]);
    expect(workspacesFor(['Admin']).map((w) => w.id)).toEqual(['ops', 'marketplace']);
    expect(workspacesFor(['Citizen']).map((w) => w.id)).toEqual(['citizen']);
  });

  it('only accepts same-app return URLs', () => {
    expect(safeReturnUrl('/ops/devices')).toBe('/ops/devices');
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('/login?x=1')).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});
