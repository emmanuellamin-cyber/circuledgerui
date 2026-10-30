import { Injectable, computed, effect, signal } from '@angular/core';
import type { Listing } from '../../core/api/types';

export interface CartItem {
  listingId: string;
  listingCode: string;
  title: string;
  priceSle: number;
  photoUrl: string | null;
  certificateNumber: string | null;
}

const KEY = 'cl.cart';
/** POST /orders accepts 1–20 unique listing IDs (§8.14). */
export const MAX_CART = 20;

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Client-side cart (§8.14): kept in localStorage; the server only sees it at checkout. */
@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>(load());
  readonly count = computed(() => this.items().length);
  readonly total = computed(() => this.items().reduce((s, i) => s + i.priceSle, 0));
  readonly full = computed(() => this.count() >= MAX_CART);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.items()));
      } catch {
        // storage unavailable: the cart just isn't remembered
      }
    });
  }

  has(id: string): boolean {
    return this.items().some((i) => i.listingId === id);
  }

  add(l: Listing, photoUrl: string | null): boolean {
    if (this.has(l.id) || this.full()) return false;
    this.items.update((list) => [
      ...list,
      {
        listingId: l.id,
        listingCode: l.listingCode,
        title: l.title,
        priceSle: l.priceSle,
        photoUrl,
        certificateNumber: l.certificateNumber,
      },
    ]);
    return true;
  }

  remove(id: string): void {
    this.items.update((list) => list.filter((i) => i.listingId !== id));
  }

  clear(): void {
    this.items.set([]);
  }
}
