# GigPredict AI Premium White Design System

This is the recommended UI direction for GigPredict AI if the product should feel like a premium fintech SaaS app instead of a dark demo dashboard.

## Product Feel

- White-first and calm
- Clean hierarchy over visual effects
- Operational, not futuristic
- Built for trust, clarity, and fast scanning
- Labels should stay simple: `Dashboard`, `Claims`, `Policy`, `Profile`

## Core Principles

- Use white as the default surface, not an accent.
- Keep information understandable in three seconds.
- Use one strong primary color and one restrained positive accent.
- Prefer borders and spacing over blur, glow, or decoration.
- Let the card layout carry the interface.

## Design Tokens

### Colors

| Token | Value | Purpose |
| --- | --- | --- |
| Canvas | `#ffffff` | Main app background |
| Surface | `#f8fafc` | Secondary sections, page bands, soft panels |
| Border | `#e2e8f0` | Card, divider, input, table borders |
| Text Strong | `#0f172a` | Headings, values, key labels |
| Text Muted | `#64748b` | Secondary text and helper copy |
| Text Soft | `#94a3b8` | Metadata and low-priority labels |
| Primary | `#2563eb` | Main CTA, active nav, key links |
| Accent | `#22c55e` | Success states and policy-safe indicators |
| Warning | `#f59e0b` | Attention states |
| Danger | `#ef4444` | Fraud, blocked, error states |

### Typography

- Font family: `Inter`
- Page title: `text-3xl md:text-4xl font-semibold tracking-tight text-slate-900`
- Section title: `text-xl md:text-2xl font-semibold text-slate-900`
- Card label: `text-sm font-medium text-slate-500`
- Body copy: `text-sm md:text-base leading-6 text-slate-600`
- Metric value: `text-3xl md:text-4xl font-semibold tracking-tight text-slate-900`

### Spacing

- Page padding: `px-4 py-6 md:px-6 md:py-8 xl:px-8`
- Card padding: `p-6`
- Tight card padding: `p-4`
- Grid gap: `gap-4` for dense data, `gap-6` for page layout
- Section stack: `space-y-6`

### Radius and Elevation

- App cards: `rounded-2xl`
- Primary containers: `rounded-3xl`
- Buttons and inputs: `rounded-xl`
- Standard shadow: `shadow-md`
- Productized shadow token: `shadow-fintech`

## App Layout

### Shell

Use a persistent application shell on desktop:

```text
[ Sidebar 280px ] [ Top Navbar ]
                 [ Main Content ]
```

Recommended wrapper:

```jsx
<div className="min-h-screen bg-white text-slate-900 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
  <aside className="hidden lg:block border-r border-slate-200 bg-white">
    ...
  </aside>

  <div className="min-w-0">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      ...
    </header>

    <main className="bg-slate-50">
      ...
    </main>
  </div>
</div>
```

### Sidebar

- White background
- 280px width
- Logo at top
- Primary nav in the middle
- Profile/account actions at the bottom
- Active item should use `bg-blue-50 text-blue-600`

Recommended nav item:

```jsx
className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
```

Active nav item:

```jsx
className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-600"
```

### Top Navbar

- Sticky, white, thin bottom border
- Left side: page title and short subtitle
- Right side: search or filters, notifications, profile
- Keep height compact: `h-16` to `h-18`

Recommended navbar container:

```jsx
className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur md:px-6 xl:px-8"
```

### Main Content

- Use `bg-slate-50` behind content blocks
- Constrain content with `max-w-[1440px]`
- Let cards sit on white for financial clarity

Recommended content wrapper:

```jsx
className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
```

## Component Recipes

### Card

Default:

```jsx
className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
```

Muted:

```jsx
className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
```

Interactive:

```jsx
className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
```

### Buttons

Primary:

```jsx
className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
```

Secondary:

```jsx
className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
```

Danger:

```jsx
className="inline-flex items-center justify-center rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
```

### Status Pills

Success:

```jsx
className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700"
```

Warning:

```jsx
className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700"
```

Danger:

```jsx
className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
```

Info:

```jsx
className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700"
```

### Inputs

```jsx
className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
```

### KPI Cards

Use the following layout for earnings, claim totals, and premium values:

```jsx
<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
  <p className="text-sm font-medium text-slate-500">Weekly earnings</p>
  <div className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Rs 18,400</div>
  <p className="mt-2 text-sm text-slate-600">Updated from last 7 days of trip history.</p>
</div>
```

### Lists and Tables

- Use white tables on a `bg-slate-50` page background
- Keep row height comfortable: `py-4`
- Use border separators, not alternating loud fills
- Right-align amounts and statuses when useful

Recommended table row:

```jsx
className="border-b border-slate-200 py-4 last:border-b-0"
```

## Dashboard Layout Recommendation

Use this page order:

1. Page header with title and quick summary
2. KPI row
3. Claims overview and policy summary side by side
4. Recent activity or alerts row

Recommended KPI grid:

```jsx
className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
```

Recommended content grid:

```jsx
className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
```

## Claims Page Recommendation

- Top filter bar with status and time range
- Main claims table
- Claim detail drawer or side panel
- Keep state colors restrained and business-like

Primary claim columns:

- Event
- Zone
- Loss
- Status
- Payout date

## Policy Page Recommendation

- Left: current policy summary
- Right: plan cards or pricing table
- Below: coverage details, exclusions, and claim rules
- Make the premium value the visual anchor

## Profile Page Recommendation

- Profile summary card
- Payout account card
- Notification preferences card
- Security and session management card

## Recommended Reusable Components

- `AppShell`
- `Sidebar`
- `SidebarItem`
- `TopNavbar`
- `PageHeader`
- `StatCard`
- `DataCard`
- `StatusBadge`
- `PrimaryButton`
- `SecondaryButton`
- `FormField`
- `EmptyState`
- `Section`
- `Table`
- `TableRow`

## Recommended Folder Structure

```text
frontend/src/
  components/
    layout/
      AppShell.js
      Sidebar.js
      TopNavbar.js
    dashboard/
      EarningsCard.js
      ClaimsOverviewCard.js
      PolicySummaryCard.js
      ActivityFeed.js
    claims/
      ClaimsTable.js
      ClaimStatusBadge.js
      ClaimFilters.js
    policy/
      PolicyPlanCard.js
      CoverageBreakdown.js
    profile/
      ProfileSummaryCard.js
      PayoutMethodsCard.js
    ui/
      Button.js
      Card.js
      Input.js
      PageHeader.js
      SectionTitle.js
      StatusBadge.js
      EmptyState.js
  pages/
    Dashboard.js
    Claims.js
    Policy.js
    Profile.js
  styles/
    tokens.css
    utilities.css
```

## Utility Layer Added In Frontend

The frontend now includes optional white-theme helper classes for the next implementation pass:

- `gigpredict-white-shell`
- `gigpredict-sidebar`
- `gigpredict-topbar`
- `gigpredict-page`
- `gigpredict-card`
- `gigpredict-card-muted`
- `gigpredict-kicker`
- `gigpredict-title`
- `gigpredict-subtitle`
- `gigpredict-value`
- `gigpredict-sidebar-link`
- `gigpredict-sidebar-link-active`
- `gigpredict-button-primary`
- `gigpredict-button-secondary`
- `gigpredict-input`
- `gigpredict-label`
- `gigpredict-status-*`

## UX Copy Rules

- Prefer plain labels over concept branding.
- Use short subtitles that explain purpose, not marketing.
- Keep actions direct: `Submit claim`, `Update policy`, `View payout`, `Edit profile`
- Put money, time, and status first when displaying data.

## Final Direction

If you implement the shell and component recipes above, GigPredict AI will read as a credible fintech product: white, structured, premium, and operational without drifting into generic AI-dashboard styling.

