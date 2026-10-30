import { Injectable, signal } from '@angular/core';

/**
 * Optional key-press "haptics": a short WebAudio tick plus a 8 ms vibration on phones.
 * Muted by default; the AudioContext is only created after the user unmutes (autoplay rules).
 */
@Injectable()
export class KeyFeedback {
  readonly enabled = signal(false);
  private ctx: AudioContext | null = null;

  toggle(): void {
    this.enabled.update((v) => !v);
  }

  tick(kind: 'key' | 'send' = 'key'): void {
    if (!this.enabled()) return;
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = kind === 'send' ? 660 : 1250;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
      navigator.vibrate?.(8);
    } catch {
      // Audio unavailable: silently ignore.
    }
  }
}
