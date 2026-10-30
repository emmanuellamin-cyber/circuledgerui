import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  HandCoins,
  LucideAngularModule,
  LucideIconData,
  Megaphone,
  Recycle,
  ShieldCheck,
  Store,
} from 'lucide-angular';
import { LiquidDirective, RevealDirective } from '../../shared/ui';

interface Stage {
  title: string;
  body: string;
  icon: LucideIconData;
}

/** The five-stage pipeline as a glass timeline: horizontal on desktop, vertical on phones. */
@Component({
  selector: 'pipeline-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LiquidDirective, RevealDirective],
  template: `
    <ol class="track" reveal>
      <span class="rail" aria-hidden="true"><span class="fill"></span></span>
      @for (s of stages; track s.title; let i = $index) {
        <li class="stage" [reveal]="i + 1">
          <span class="node" aria-hidden="true">
            <lucide-icon [img]="s.icon" [size]="22" />
          </span>
          <div class="card glass" liquid>
            <span class="step num">0{{ i + 1 }}</span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.body }}</p>
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .track {
      position: relative;
      display: grid;
      gap: var(--s-4);
      margin: 0;
      padding: 0 0 0 64px;
      list-style: none;
      opacity: 1;
      transform: none;
    }
    .rail {
      position: absolute;
      left: 25px;
      top: 26px;
      bottom: 26px;
      width: 4px;
      border-radius: 4px;
      background: var(--neutral-bg);
      overflow: hidden;
    }
    .fill {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, #10b981, #0a84c6 60%, #f59e0b);
      transform-origin: top;
      transform: scaleY(0);
      transition: transform 1800ms var(--ease-out) 200ms;
    }
    .track.in-view .fill {
      transform: scaleY(1);
    }
    .stage {
      position: relative;
    }
    .node {
      position: absolute;
      left: -64px;
      top: 14px;
      display: grid;
      place-items: center;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      color: #fff;
      background: var(--accent-gradient);
      box-shadow:
        0 0 0 6px var(--glass-fill-subtle),
        0 10px 24px -8px rgb(10 95 143 / 0.6);
    }
    .stage.in-view .node {
      animation: pulse 2.4s var(--ease-out) calc(var(--i) * 300ms) 1;
    }
    .card {
      padding: var(--s-4) var(--s-5);
      border-radius: var(--r-lg);
      display: grid;
      gap: 6px;
    }
    .step {
      font-size: var(--fs-xs);
      font-weight: 700;
      color: var(--accent-ink);
      letter-spacing: 0.08em;
    }
    p {
      color: var(--text-2);
      font-size: var(--fs-sm);
    }

    @media (min-width: 1000px) {
      .track {
        grid-template-columns: repeat(5, 1fr);
        padding: 76px 0 0;
        gap: var(--s-3);
      }
      .rail {
        left: 10%;
        right: 10%;
        top: 25px;
        bottom: auto;
        width: auto;
        height: 4px;
      }
      .fill {
        background: linear-gradient(90deg, #10b981, #0a84c6 60%, #f59e0b);
        transform-origin: left;
        transform: scaleX(0);
      }
      .track.in-view .fill {
        transform: scaleX(1);
      }
      .node {
        left: 50%;
        top: -76px;
        translate: -50% 0;
      }
      .card {
        height: 100%;
        align-content: start;
      }
    }
    @keyframes pulse {
      0% {
        box-shadow:
          0 0 0 6px var(--glass-fill-subtle),
          0 0 0 6px rgb(16 185 129 / 0.5);
      }
      100% {
        box-shadow:
          0 0 0 6px var(--glass-fill-subtle),
          0 0 0 22px rgb(16 185 129 / 0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .fill {
        transition: none;
        transform: none !important;
      }
      .stage.in-view .node {
        animation: none;
      }
    }
  `,
})
export class PipelineTimeline {
  protected readonly stages: Stage[] = [
    {
      title: 'Educate',
      body: 'Talks and workshops in schools, campuses and on radio about e-waste, battery safety and data privacy.',
      icon: Megaphone,
    },
    {
      title: 'Collect & Buy',
      body: 'Dial the USSD code or send an SMS. Drop the phone at a hub, kiosk or Solar Makit, or an agent picks it up. You get paid.',
      icon: HandCoins,
    },
    {
      title: 'Wipe & Certify',
      body: 'Every phone is wiped with an approved method, then you receive a signed Certificate of Data Sanitization anyone can verify.',
      icon: ShieldCheck,
    },
    {
      title: 'Recover & Log',
      body: 'Working parts are recovered; lithium batteries and lead are stored safely. Every step is written to a tamper-evident ledger.',
      icon: Recycle,
    },
    {
      title: 'Resell',
      body: 'Refurbished phones and parts are sold with a warranty. Part of every sale is reinvested in buying phones and training youth.',
      icon: Store,
    },
  ];
}
