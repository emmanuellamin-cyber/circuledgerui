import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowRight,
  BadgeCheck,
  Battery,
  Briefcase,
  GraduationCap,
  HandCoins,
  LucideAngularModule,
  LucideIconData,
  MapPin,
  MessageSquare,
  Phone,
  School,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck,
  UsersRound,
} from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { GlassButton, GlassCard, LiquidDirective, RevealDirective } from '../../shared/ui';
import { DropOffPoints } from '../public/drop-off/drop-off-points';
import { PriceQuoteWidget } from '../public/price-quote/price-quote-widget';
import { CertificateVerifyWidget } from '../public/verify-certificate/certificate-verify-widget';
import { HeroPhone } from './hero-phone';
import { PipelineTimeline } from './pipeline-timeline';

interface Target {
  value: string;
  label: string;
  icon: LucideIconData;
}

@Component({
  selector: 'landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    GlassButton,
    GlassCard,
    LiquidDirective,
    RevealDirective,
    HeroPhone,
    PipelineTimeline,
    PriceQuoteWidget,
    CertificateVerifyWidget,
    DropOffPoints,
  ],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly ussdCode = environment.ussdServiceCode;
  protected readonly i = {
    ArrowRight,
    BadgeCheck,
    HandCoins,
    MapPin,
    MessageSquare,
    Phone,
    ShieldCheck,
    ShoppingBag,
    Smartphone,
    Truck,
  };

  /**
   * There is no public KPI endpoint (GET /dashboard/kpis is Ops-only), so the strip shows the
   * pilot targets from §8.17 and labels them as targets, not results.
   */
  protected readonly targets: Target[] = [
    { value: '500', label: 'phones collected', icon: Smartphone },
    { value: '50 kg', label: 'hazardous waste diverted', icon: Battery },
    { value: '20', label: 'youth technicians trained', icon: GraduationCap },
    { value: '5', label: 'jobs created', icon: Briefcase },
    { value: '5 + 2', label: 'schools and campuses reached', icon: School },
    { value: '≥ 40%', label: 'women among trainees and hires', icon: UsersRound },
  ];
}
