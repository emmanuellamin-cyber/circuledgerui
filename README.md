# CircuLedger Web

Frontend for the **Smart Youth Mobile Circularity Hub** (Njala University · UNDP × Samsung Youth Mobile
Circularity Innovation Challenge, Sierra Leone). Angular 22 (standalone, signals, zoneless, new control
flow), SCSS design tokens, a hand-built Liquid Glass component library, Angular CDK, Lucide icons and Leaflet.

The API contract is `FRONTEND_INTEGRATION_GUIDE.md` (the "guide"). Section numbers below (§) refer to it.

## Status

| Milestone | State |
|---|---|
| 1 Read the guide | ✅ |
| 2 Core API client, types, interceptors, auth | ✅ |
| 3 Design tokens, liquid background, glass components | ✅ (see `/design-system`) |
| 4 Landing, login, register, role routing, 403/404 | ✅ |
| 5 USSD and SMS simulator | ✅ (`/demo/ussd`, `/ops/tools/ussd`) |
| 6 Ops dashboard (`/ops`, all §9 A screens, sidebar, Ctrl/Cmd+K palette, breadcrumbs, health dot) | ✅ |
| 7–8 Workshop (§9 B) and Field (§9 C) | ➜ moved to the Flutter app **`../circuledger_mobile`** (see its README) |
| 9 Marketplace (`/marketplace`, §9 D) and Citizen portal (`/citizen`, §9 E) | ✅ |
| 10 Tests (64 unit + 1 e2e), ESLint, Prettier, README | ✅ |

**Workshop and Field are a separate mobile app.** Technicians and field agents use the Flutter app in
`C:\Users\USER\WebstormProjects\circuledger_mobile` (Android/iOS, same API, same accounts). On the
web they land on `/mobile-app`, which explains this, and old `/workshop` and `/field` links redirect
there. Admins and Operations leads use the Operations dashboard here and can also sign in to the app.

Everything builds, lints and passes the unit tests. It has **not yet been exercised against a running
API or in a browser**; the e2e test is the first thing to run once the API is up.

## Setup

```bash
npm install
npm start            # ng serve on http://localhost:4200, proxied to the API on :5097
npm run start:docker # same, proxied to the docker-compose API on :8080
npm test             # unit tests (Vitest)
npm run lint         # ESLint (angular-eslint, typescript-eslint, template accessibility rules)
npm run format       # Prettier
npm run e2e          # Playwright; needs the API running (see below)
npm run build        # production build (apiBase http://localhost:5097)
npm run build:docker # production build (apiBase http://localhost:8080)
```

**E2E.** `e2e/ussd-to-intake.spec.ts` dials the USSD code in the simulator, follows the §10 hops to an
END reference, then logs in as Ops and finds that intake request. Start the API on :5097 first.
`ng serve` is started automatically. First run: `npx playwright install chromium`. Override the
account with `E2E_OPS_EMAIL` / `E2E_OPS_PASSWORD`, or point at a deployed build with `E2E_BASE_URL`.

`lucide-angular` declares peer support up to Angular 21; `package.json` has an `overrides` entry so it
installs against Angular 22 (it only uses stable core APIs).

### Dev proxy (why port 4200 works without CORS changes)

The API only accepts browser calls from `localhost:3000` and `:5173` (§1). In development
`environment.development.ts` sets `apiBase: ''`, so every call is same-origin (`/api/v1/...`) and
`proxy.conf.json` forwards `/api`, `/health`, `/openapi` and `/swagger` to `http://localhost:5097`
(`proxy.docker.conf.json` → `:8080`). The browser never makes a cross-origin request, so CORS doesn't
apply. Production builds call `apiBase` directly, and that origin must be added on the API
(`Cors__AllowedOrigins__N`).

### Environment variables (`src/environments/*.ts`)

| Key | Dev | Prod / Docker | Meaning |
|---|---|---|---|
| `apiBase` | `''` (proxy) | `http://localhost:5097` / `:8080` | API origin without `/api/v1` |
| `showDemoAccounts` | `true` | `false` | "Demo accounts" helper on `/login` |
| `ussdServiceCode` | `*384*1234#` | same | Shown on the landing page, pre-filled in the simulator |
| `gatewayToken` | `null` | `null` | Appended as `?token=` to USSD/SMS webhooks when `Gateway:WebhookToken` is on (§8.19) |
| `smsHubNumber` | `CircuLedger` | same | `to` field for the SMS simulator. Placeholder until the backend confirms the number |

## How each role logs in

Go to `/login` (dev builds list the §2 demo accounts; tap one to fill the form). After login you're
redirected by role, priority **Admin > OperationsLead > Technician > FieldAgent > Buyer > Citizen**:

| Role | Lands on | Demo account |
|---|---|---|
| Admin | `/ops` | `admin@circuledger.local` |
| OperationsLead | `/ops` | `ops@circuledger.local` |
| Technician | `/mobile-app` (info page; work happens in the Flutter app) | `tech@circuledger.local` |
| FieldAgent | `/mobile-app` (info page; work happens in the Flutter app) | `agent@circuledger.local` |
| Buyer | `/marketplace` | `buyer@circuledger.local` |
| Citizen | `/citizen` | register at `/register` → "Sell phones" |

Users with several roles get a workspace switcher in the profile menu. Guards mirror the API policy
groups (e.g. Admin and Operations leads can use the buyer screens), but they're UX only: every 403 from the API is still handled.

## Screen map

**Public**

| Route | Screen | Endpoints |
|---|---|---|
| `/` | Landing: hero, pipeline, pilot targets, price quote, ways to sell, drop-off points (list/map), verify | `GET /public/pricing/quote`, `GET /public/drop-off-points`, `GET /public/certificates/{no}/verify` |
| `/verify`, `/verify/:no` | Certificate verification | `GET /public/certificates/{no}/verify` |
| `/login`, `/register` | Log in (lockout, demo accounts in dev), Buyer / Citizen sign-up | `POST /auth/login`, `POST /auth/register` |
| `/demo/ussd` | USSD + SMS simulator | `POST /ussd/callback`, `POST /sms/inbound` |
| `/design-system` | Living style guide | — |
| `/403`, `**` | Friendly glass error pages | — |

**Operations** (`/ops`, Admin + OperationsLead; sidebar, Ctrl/Cmd+K, breadcrumbs, API health dot)

| Route | Screen | Endpoints (§9 A) |
|---|---|---|
| `/ops` | Home / KPIs: target rings, money tiles, intake & sales charts, ledger integrity badge | `/dashboard/kpis`, `/dashboard/time-series/*`, `/ledger/verify`, `/health` |
| `/ops/reports` | CSV exports | `/dashboard/export/kpis.csv`, `/weekly.csv` |
| `/ops/intake` | Inbox: filters, detail panel, receive / cancel / reject, new request, walk-in | `/intake-requests*`, `/drop-off-points` |
| `/ops/intake/unlocated` | Pending pickups without coordinates | `/intake-requests?…`, `PUT …/pickup-location` |
| `/ops/dispatch` | Generate batches, browse batches and pickups | `/dispatch/batches*`, `/users?role=FieldAgent` |
| `/ops/devices`, `/ops/devices/:id` | Register; detail with ledger timeline, purchase, payout, create listing | `/devices*`, `/ledger/devices/{trackingId}` |
| `/ops/purchase` | Purchase desk: quote + Seed Fund balance, buy, record payout | `/public/pricing/quote`, `/funds`, `/devices/{id}/purchase*` |
| `/ops/certificates`, `/:no` | List; detail with QR preview, PDF/QR download, revoke (Admin) | `/certificates*` |
| `/ops/ledger` | Ledger explorer + verify | `/ledger`, `/ledger/verify` |
| `/ops/listings`, `/:id` | Listings: create, edit, photos, verify, publish, withdraw | `/listings*`, `/recovery/components?status=InStock`, `/devices?status=Refurbishing` |
| `/ops/orders` | Pay, fulfil, cancel; reinvestment shown | `/orders*` |
| `/ops/funds` | Balances, transactions, movements (Admin), reinvestment rule + history | `/funds*`, `/reinvestment-rule*` |
| `/ops/pricing` | Brand × condition matrix | `/pricing/matrix` |
| `/ops/training` | Cycles, enrollments, safety, jobs | `/training/*`, `/employment` |
| `/ops/awareness` | Campaigns with institution autocomplete | `/awareness-campaigns` |
| `/ops/hazardous` | Summary + log | `/recovery/hazardous-materials*` |
| `/ops/users` | Staff accounts, roles, activate (Admin) | `/users*` |
| `/ops/drop-off-points` | Create / edit / soft-delete | `/drop-off-points*` |
| `/ops/tools/ussd` | Simulator with "Look up intake request" | as `/demo/ussd` + `/intake-requests?referenceCode=` |

**Mobile app** (`/mobile-app`): explains that Workshop and Field are in the CircuLedger Flutter app
(`../circuledger_mobile`) and how to get it. `/workshop/**` and `/field/**` redirect here.

**Marketplace** (`/marketplace`): browse with URL-synced filters and 300 ms debounced search, product
page with live certificate check, client-side cart, checkout (`POST /orders`, 409 handling), My orders
(Buyer). **Citizen** (`/citizen`): my sell requests with progress, new sell request.

## Architecture

```
src/app/
  core/api/         types.ts (§11 verbatim), types.extra.ts (other guide shapes, each cites its §),
                    api.service.ts, public.api.ts, api-error.ts, problem-mapping.ts
  core/auth/        auth.service.ts (session signals + single-flight refresh), roles.ts, guards.ts
  core/http/        auth.interceptor.ts, problem.interceptor.ts
  core/format|enums|theme/
  shared/ui/        glass-card, glass-button, glass-input, glass-select, glass-modal (+ ModalService.confirm),
                    glass-tabs, glass-toast, glass-nav, stat-tile, progress-ring, status-pill, empty-state,
                    skeleton, liquid-background, glass-filters, [liquid], [reveal]
                    glass-chart (Chart.js, lazy), glass-map (Leaflet, lazy), glass-switch, checkbox-group,
                    paginator, page-header
  shared/pipes.ts   sle, masked, relativeTime
  core/state/       url-query (filters + page in the URL), action (busy / ProblemDetails / toasts)
  layout/           public-shell, user-menu
  features/         landing, auth, errors, public/*, design-system, tools/*, ops/*, marketplace/*,
                    citizen/, mobile-app/ (Workshop & Field live in ../circuledger_mobile)
src/styles/         _tokens.scss, _glass.scss, _base.scss, _utilities.scss, _mixins.scss
```

**Port of the §12 client.** `HttpClient` + functional interceptors replace `fetch`.
`problemInterceptor` (outermost) turns every failure into `ApiError` with ProblemDetails;
`authInterceptor` adds the bearer token and, on 401, awaits `AuthService.refreshOnce()`. That method
shares one in-flight promise, so the same refresh token is never sent twice. A request that fails
after another one already rotated the token retries with the new token instead of refreshing again.
The refresh itself goes through `HttpBackend`, so it can't trigger the interceptors.

**Liquid Glass.** One global `.glass` implementation (blur + saturate, inner rim, specular `::before`).
Nested glass doesn't re-blur, which keeps one backdrop-filter per stack. The SVG refraction filter
(`.glass--lens`, feTurbulence + feDisplacementMap) only turns on in Chromium with a fine pointer;
Safari, Firefox and phones get plain blur. Phones also get a smaller blur radius and fewer background
blobs. The blobs move with transform-only keyframes, so animating them doesn't repaint.
`prefers-reduced-motion` stops all animation; `prefers-reduced-transparency` or the "Solid surfaces"
menu toggle switch to opaque surfaces.

## USSD & SMS simulator

`features/tools/ussd-simulator` talks to the real API:

- `POST /api/v1/ussd/callback`, form-encoded `sessionId`, `serviceCode`, `phoneNumber`, `text`, with
  `?token=` when `gatewayToken` is set. `text` is the whole history joined by `*`. `CON ` keeps the
  dialog open, `END ` closes it; the first 4 characters are stripped. Menu text is never hard-coded.
- Dialer (type `*384*1234#` or tap "Dial …") → "USSD code running…" → Android-style dialog. The soft
  keyboard opens on focus. It is numeric for menus and switches to QWERTY when the prompt asks for a
  name, area, landmark, code or certificate (`suggestsText`). The physical keyboard works on the
  dialer and in the reply field. Key sounds are off by default.
- Quick-select chips are parsed from the numbered lines of the response. Tapping one fills the reply.
- Control panel: phone number, service code, network, **New session** (fresh `crypto.randomUUID`),
  a 180 s session countdown, and a request log (time, `text`, raw response, latency, Copy as curl).
- END messages highlight reference codes and certificate numbers, with Copy, **Look up intake
  request** (Ops only) and **Verify certificate** (public endpoint, in a modal).
- Network errors, 429s and invalid service codes show "Connection problem or invalid MMI code." on
  the phone. A late response from an abandoned session is ignored.
- **Run demo script** plays §10 step 1 (`""` → `1` → … → `1*1*2*2*Towama*1`) with typing animation;
  Pause, Resume, Step (one hop at a time) and Stop.
- SMS tab: a chat against `POST /sms/inbound` (`from`, `text`, `to`, `id`, `date`) with keyword chips.
  STATUS and VERIFY reuse the last reference or certificate seen.

## §13 checklist

- [x] **Single-flight refresh** — `AuthService.refreshOnce()`, covered by `auth.interceptor.spec.ts`
- [x] Access token in memory, refresh token persisted, `restoreSession()` on app start (`provideAppInitializer`)
- [x] UTC ISO date-times (`new Date().toISOString()`; the mobile wipe timer sends UTC too) and `YYYY-MM-DD` dates (native date inputs, `isoDate()`)
- [x] Enums are strings with exact §6 names (§11 types; option lists in `core/enums/labels.ts`)
- [x] Money as `SLE 1,200.00` (`formatSle`, `sle` pipe; formatted manually because not every browser's ICU has SLE)
- [x] Branch on `problem.code`, show `problem.detail`, map `errors` PascalCase → camelCase (`applyProblemToForm`, `useAction`)
- [x] Blob downloads with the auth header: certificate PDF/QR, staff listing photos, CSVs. Public photos via `apiUrl(photo.url)`
- [x] Upload field `file`, no manual Content-Type (`ListingsApi.uploadPhoto`, FormData)
- [x] Phone numbers accepted in local format, shown only masked
- [x] `…/contact` fetched only on the "Call seller" tap, never cached or prefetched (mobile app: `BatchScreen._call`)
- [x] Publish disabled until a verified photo. ⚠ Verify can't be disabled for the uploader because `ListingPhoto` has no uploader field; the API's 403 is shown (backend question 10)
- [x] Certificate badge on refurbished listings (browse cards, product page with live verify, cart, orders)
- [x] `409 listing_unavailable` → every cart item is re-fetched and unavailable ones are dropped (`MarketplaceCart`)
- [x] Safety-gated 403s show the API message plus "Ask an Operations Lead to record your safety training" (mobile app, Workshop)
- [x] 429 → readable message (toasts, forms, USSD "Connection problem"); marketplace and list searches debounced 300 ms
- [x] Role change needs a fresh login: stated in the Users → Edit roles dialog
- [x] Consistent `institutionName`: autocomplete from earlier entries and case/space snapping (Awareness)

## Backend questions

1. **Public impact numbers.** `GET /dashboard/kpis` is Ops-only, so the landing page shows *pilot
   targets* labelled as such. Could there be a public, cached KPI summary (devices collected, kg
   diverted, youth trained)?
2. **Brand list.** The USSD menu offers brands 1–7, but no public endpoint lists them (the pricing
   matrix is Staff-only). The quote widget uses free text with suggestions. Could `/public/pricing/brands` exist?
3. **SMS number.** Which short code or number should citizens text `SELL …` to? The landing page
   shows the keyword format but no number.
4. **Lockout signal.** A locked account returns 401 with "temporarily locked" in `detail`. A stable
   `code` (e.g. `account_locked`) and remaining lock time would be more robust than text matching.
5. **Verify page URL.** Please set `Hub:PublicBaseUrl` so certificate QR codes point at
   `{webOrigin}/verify/{no}` (§8.3).
6. **Gateway token.** Will `Gateway:WebhookToken` be enabled in the demo environment? If so, the
   simulator needs the token value (it would be visible in the browser bundle).
7. **USSD reference format.** The simulator detects reference codes after "Ref:" or as `SY` + 6
   characters (from the §8.19 / §10 examples). Is that format guaranteed?
8. **SMS `to` field.** What value should `POST /sms/inbound` receive as `to`? The simulator sends
   `smsHubNumber` (placeholder `CircuLedger`, editable in the environment).
9. **Payout filter.** `GET /devices` can't filter by `purchase.payoutStatus`, so the Purchase desk
   checks the 100 most recent devices for pending payouts. Could the API add `payoutStatus`?
10. **Photo uploader.** `ListingPhoto` has no uploader id, so the UI can't disable **Verify** for the
    uploader (§13). The API's 403 is shown instead.
11. **Field-agent list for Ops leads.** `GET /users` is Admin-only, so an OperationsLead can't pick
    agents in the dispatch planner or link trainees to staff accounts. Could there be a Staff-level list?
12. **Components per device.** `GET /recovery/components` can't filter by device, so the workshop
    only lists parts added in the current session. Could it accept `deviceId`?
13. **Citizen phone.** `UserProfile` has no phone, so the citizen's "Sell a phone" form asks for it again.
    Could the profile include the registered (masked) phone?
