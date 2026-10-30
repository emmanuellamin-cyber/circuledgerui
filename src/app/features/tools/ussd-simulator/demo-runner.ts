import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { UssdSessionStore } from './ussd-session.store';

/**
 * §10 step 1: "" → 1 → 1*1 → 1*1*2 → 1*1*2*2 → 1*1*2*2*Towama → 1*1*2*2*Towama*1.
 * These are the user's inputs only. Every prompt shown comes from the API.
 */
export const DEMO_ENTRIES: readonly string[] = ['1', '1', '2', '2', 'Towama', '1'];

export type DemoState = 'idle' | 'running' | 'paused' | 'done';

class Cancelled extends Error {}

/** Plays the walkthrough on the simulated phone with typing animation, for live pitches. */
@Injectable()
export class DemoRunner {
  private readonly store = inject(UssdSessionStore);

  readonly state = signal<DemoState>('idle');
  /** 0 = dialling the service code, 1…n = DEMO_ENTRIES[i - 1]. */
  readonly step = signal(-1);
  readonly entries = DEMO_ENTRIES;

  private runId = 0;
  private release: (() => void) | null = null;
  private pauseAfterHop = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async start(): Promise<void> {
    if (this.state() === 'running' || this.state() === 'paused') return;
    const id = ++this.runId;
    this.state.set('running');
    try {
      this.store.newSession();
      this.store.dialed.set('');
      this.step.set(0);
      for (const ch of this.store.serviceCode()) {
        await this.checkpoint(id);
        this.store.press(ch);
        this.store.flashKey(ch);
        await this.wait(id, 150);
      }
      await this.wait(id, 400);
      await this.checkpoint(id);
      await this.store.dial();
      this.afterHop();

      for (let i = 0; i < this.entries.length; i++) {
        if (this.store.screen() !== 'dialog') break;
        this.step.set(i + 1);
        await this.wait(id, 900);
        for (const ch of this.entries[i]) {
          await this.checkpoint(id);
          this.store.press(ch);
          this.store.flashKey(ch);
          await this.wait(id, 120);
        }
        await this.wait(id, 450);
        await this.checkpoint(id);
        await this.store.send();
        this.afterHop();
      }
      this.state.set('done');
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  pause(): void {
    if (this.state() === 'running') this.state.set('paused');
  }

  resume(): void {
    if (this.state() !== 'paused') return;
    this.pauseAfterHop = false;
    this.state.set('running');
    this.release?.();
  }

  /** Runs exactly one hop, then pauses. Starts the script if it isn't running. */
  next(): void {
    this.pauseAfterHop = true;
    if (this.state() === 'idle' || this.state() === 'done') {
      void this.start();
    } else if (this.state() === 'paused') {
      this.state.set('running');
      this.release?.();
    }
  }

  stop(): void {
    this.runId++;
    this.pauseAfterHop = false;
    this.state.set('idle');
    this.step.set(-1);
    this.release?.();
  }

  private afterHop(): void {
    if (this.pauseAfterHop) {
      this.pauseAfterHop = false;
      this.state.set('paused');
    }
  }

  private async checkpoint(id: number): Promise<void> {
    while (this.state() === 'paused' && id === this.runId) {
      await new Promise<void>((r) => (this.release = r));
      this.release = null;
    }
    if (id !== this.runId) throw new Cancelled();
  }

  private async wait(id: number, ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
    if (id !== this.runId) throw new Cancelled();
  }
}
