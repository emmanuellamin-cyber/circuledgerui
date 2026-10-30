import { TestBed } from '@angular/core/testing';
import type { Listing } from '../../core/api/types';
import { CartService, MAX_CART } from './cart.service';

const listing = (id: string, price = 100): Listing => ({
  id,
  listingCode: `LST-${id}`,
  itemType: 'RefurbishedDevice',
  title: `Phone ${id}`,
  description: null,
  brand: 'Samsung',
  model: 'Galaxy A14',
  isSamsung: true,
  componentType: null,
  priceSle: price,
  condition: 'B',
  warrantyDays: 90,
  status: 'Published',
  publishedAt: null,
  certificateNumber: 'CDS-2026-000045',
  certificateVerificationUrl: null,
  photos: [],
});

describe('CartService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('adds unique items and totals them', () => {
    const cart = TestBed.inject(CartService);
    expect(cart.add(listing('a', 1200), null)).toBe(true);
    expect(cart.add(listing('a', 1200), null)).toBe(false);
    cart.add(listing('b', 350), null);
    expect(cart.count()).toBe(2);
    expect(cart.total()).toBe(1550);
  });

  it(`stops at ${MAX_CART} items (POST /orders limit)`, () => {
    const cart = TestBed.inject(CartService);
    for (let n = 0; n < MAX_CART + 3; n++) cart.add(listing(String(n)), null);
    expect(cart.count()).toBe(MAX_CART);
    expect(cart.full()).toBe(true);
  });

  it('persists to localStorage and restores', () => {
    const cart = TestBed.inject(CartService);
    cart.add(listing('a'), null);
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('cl.cart') ?? '[]')).toHaveLength(1);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(CartService).has('a')).toBe(true);
  });
});
