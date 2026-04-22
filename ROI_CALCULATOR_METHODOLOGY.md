# Identity Recovery ROI Calculator — Technical Guide

> Version 1.1.0 · Last calibrated 2026-03-27
> Built with Astro v6 · React 19 · TypeScript · Tailwind CSS v4

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Tech Stack and Project Structure](#2-tech-stack-and-project-structure)
3. [Calculation Engine Overview](#3-calculation-engine-overview)
4. [Configuration File](#4-configuration-file)
5. [Phase Model](#5-phase-model)
6. [Dollar Conversion](#6-dollar-conversion)
7. [TCO Model](#7-tco-model)
8. [Input Schema](#8-input-schema)
9. [Output Schema](#9-output-schema)
10. [URL State and Shareability](#10-url-state-and-shareability)
11. [UI Components](#11-ui-components)
12. [Export / PDF Summary](#12-export--pdf-summary)
13. [Key Design Decisions](#13-key-design-decisions)
14. [How to Maintain and Update](#14-how-to-maintain-and-update)
15. [Known Limitations and Caveats](#15-known-limitations-and-caveats)
16. [Benchmark Calibration Notes](#16-benchmark-calibration-notes)
17. [Sources & References](#17-sources--references)

---

## 1. Purpose and Scope

The Identity Recovery ROI Calculator estimates the financial value of faster Active Directory forest recovery using Netwrix Identity Recovery. It is a customer-facing web application intended for self-service use by prospects and customers, and for rep-assisted demos.

**What it covers:**
- Reduced AD recovery time across five recovery phases
- Business disruption avoided (revenue or workforce productivity)
- Recovery team labor savings
- External SI/IR firm cost avoidance
- Total cost of ownership (non-license overhead)

**What it explicitly does not cover:**
- Credential hygiene (KRBTGT rotation, privileged/service account resets) — time is identical with or without the tool
- Dependent service restoration (Azure AD Connect, ADFS, PKI, LDAP applications)
- Forensics, compliance reporting, or post-incident remediation
- Any workload outside AD forest recovery

---

## 2. Tech Stack and Project Structure

```
RecoveryROICalculator/
├── src/
│   ├── config/
│   │   └── roiConfig.json          # All model parameters — edit here, not in code
│   ├── lib/
│   │   ├── roiEngine.ts            # Orchestration: calls phase, dollar, TCO models
│   │   ├── phaseModel.ts           # Per-phase time computation with readiness multipliers
│   │   ├── dollarConversion.ts     # Dollar value of time saved
│   │   ├── tcoModel.ts             # Non-license ownership cost model
│   │   ├── urlState.ts             # URL param serialization / deserialization
│   │   └── analytics.ts            # Lightweight event tracking (window.dataLayer)
│   ├── components/
│   │   ├── ROICalculator.tsx       # Root React component — state, layout, calculate button
│   │   ├── Tier1Form.tsx           # Basic inputs (employees, size, readiness, revenue, SI)
│   │   ├── Tier2Form.tsx           # Advanced overrides (DC count, readiness detail, cost rates)
│   │   ├── TCOForm.tsx             # TCO inputs (infrastructure, storage, FTE %)
│   │   ├── ResultsPanel.tsx        # Results display (metric cards, tables, notes)
│   │   └── ExportSummary.tsx       # PDF export form and HTML print document builder
│   ├── types/
│   │   └── roi.ts                  # All TypeScript interfaces
│   └── pages/
│       └── index.astro             # Shell page (nav, footer, legal disclaimer)
├── tests/
│   └── roi-scenarios.mjs           # 25-scenario programmatic test suite
└── public/
    └── print.css                   # Print stylesheet (suppresses UI chrome)
```

**Key dependency facts:**
- The calculator is a React island rendered client-only (`client:only="react"`) inside an Astro static page
- No backend, no database — all computation happens in the browser
- Config is imported as a static JSON module at build time
- Tailwind CSS v4 uses `@theme` tokens defined in `global.css`

---

## 3. Calculation Engine Overview

The engine entry point is `src/lib/roiEngine.ts → calculate(inputs)`.

```
ROIInputs
    │
    ├── computePhases()        → PhaseResult[]       (phaseModel.ts)
    │       ↓
    │   sumPhases()            → baseline/tool/saved hours (RangeValue)
    │
    ├── computeDollars()       → DollarOutputs        (dollarConversion.ts)
    │
    └── computeTCO()           → TCOOutputs           (tcoModel.ts)
```

All three models read from `roiConfig.json`. The engine returns `ROIOutputs` which feeds directly into `ResultsPanel` and `ExportSummary`.

### RangeValue type

All time and dollar outputs use the `RangeValue` type:

```ts
interface RangeValue {
  conservative: number;
  expected:     number;
  aggressive:   number;
}
```

Since ranging was removed from the UI, all three fields are populated with the **same expected value** via the `scalar(n)` helper in `dollarConversion.ts`. The type is retained for structural consistency and future flexibility.

---

## 4. Configuration File

`src/config/roiConfig.json` is the single source of truth for all model parameters. **No calculation logic should be hardcoded in TypeScript files** — add new parameters here.

### Top-level keys

| Key | Purpose |
|-----|---------|
| `meta` | Version, calibration date, product name, scope description |
| `environment_size_bands` | Labels and descriptions for the four size tiers |
| `readiness_levels` | Multipliers for each readiness tier |
| `phases` | Per-phase baseline and with-tool hour ranges by size |
| `defaults` | Cost rates, product pricing, probability defaults |
| `range_multipliers` | Retained for schema compatibility (not used in UI) |
| `tco_defaults` | Infrastructure, storage, FTE, restore testing defaults |

### Readiness multipliers

| Level | Baseline multiplier | With-tool multiplier |
|-------|--------------------|--------------------|
| Limited | 1.4× | 1.1× |
| Developing | 1.0× | 0.9× |
| Mature | 0.75× | 0.8× |

Baseline multiplier inflates how long recovery takes without the tool (less prepared = harder recovery). With-tool multiplier reflects that even with the tool, a less prepared team is slower to execute. **Multipliers are not applied to phases with `tool_benefit: false`.**

### Key defaults

| Parameter | Value | Notes |
|-----------|-------|-------|
| `workforce_impact_percent` | 85% | Fraction of employees impacted when AD is down |
| `productivity_loss_factor` | 40% | Impacted employees aren't fully non-productive (cached creds, mobile, workarounds) |
| `fully_loaded_hourly_rate_usd` | $65 | BLS-calibrated fully loaded employee cost |
| `internal_ir_hourly_rate_usd` | $125 | Blended AD/security engineer rate |
| `external_si_hourly_rate_usd` | $250 | External SI/IR firm hourly rate |
| `product_cost_per_user_usd` | $12.50 | Default license cost (overrideable in Tier 2) |
| `incident_probability_default` | 5% | ~once per 20 years; deliberately conservative |
| `working_hours_per_day` | 8 | Used for revenue-per-hour calculation |
| `working_days_per_year` | 250 | Used for revenue-per-hour calculation |

---

## 5. Phase Model

**File:** `src/lib/phaseModel.ts`

Five recovery phases are defined in `roiConfig.json`. Each phase has `[min_hours, max_hours]` ranges per environment size for both baseline and with-tool scenarios.

### Phases

| Phase ID | Label | Notes |
|----------|-------|-------|
| `containment` | Containment & Decision to Restore | Readiness-driven |
| `restore_initial_dcs` | Restore Domain Controllers | Size + DC-count driven |
| `reestablish_core_ad` | Re-establish Core AD Services | Size + DC-count driven |
| `credential_hygiene` | Credential Hygiene | `tool_benefit: false` — identical in both scenarios |
| `validation_cutover` | Validation & AD Operational | Readiness-driven |

### `tool_benefit: false` flag

The credential hygiene phase sets `tool_benefit: false`. This instructs `computePhases` to skip readiness multipliers entirely for that phase — the same raw config hours are used on both sides. Without this flag, a mature-readiness environment would see a *lower* baseline and an *even lower* with-tool time, producing negative savings — which is logically wrong since the tool provides no benefit here.

### Tier 2 DC count scaling

When `tier === 'tier2'` and `dc_count` is provided, the `restore_initial_dcs` and `reestablish_core_ad` phases are scaled using a square root factor:

```ts
scaleFactor = Math.sqrt(dc_count / baseDcCount[size])
```

Square root is used because larger DC counts have diminishing per-DC overhead (parallelism, automation efficiency). This applies to both baseline and with-tool hours proportionally.

### Tier 2 readiness detail override

When detailed readiness fields are set (backup frequency, runbook, staff experience, last test, segregated environment), a composite score is computed and mapped to one of the three readiness tiers:

| Score | Maps to |
|-------|---------|
| ≥67% | Mature (0.75× / 0.8×) |
| 34–66% | Developing (1.0× / 0.9×) |
| <34% | Limited (1.4× / 1.1×) |

This overrides the Tier 1 readiness proxy selection when any detail fields are set.

---

## 6. Dollar Conversion

**File:** `src/lib/dollarConversion.ts`

### Business disruption avoided

Two mutually exclusive drivers. Revenue is used when provided; labor is the fallback.

**Revenue driver:**
```
revenue_per_hour = annual_revenue / (250 days × 8 hrs)
disruption_avoided = revenue_per_hour × hours_saved
```

**Labor driver:**
```
impacted_employees = total_employees × workforce_impact_percent (85%)
labor_cost_per_hour = impacted_employees × hourly_rate × productivity_loss_factor (40%)
disruption_avoided = labor_cost_per_hour × hours_saved
```

The productivity loss factor (40%) acknowledges that impacted employees aren't completely non-productive — cached credentials, mobile access, offline workarounds, and manual processes reduce actual loss.

### Recovery team labor avoided

```
labor_avoided = hours_saved × internal_ir_rate × recovery_team_size
```

Recovery team size scales with environment:

| Size | Team size |
|------|-----------|
| Small | 2 |
| Medium | 4 |
| Large | 6 |
| Enterprise | 10 |

### External services avoided

Applied only when `external_si_engaged = true`.

**If a custom SI cost is provided:**
```
si_avoided = custom_cost × 0.35
```
The 35% factor reflects that Identity Recovery eliminates the AD forest recovery portion of a full IR engagement (~30–40% of scope). The remaining 65% (credential hygiene, forensics, dependent service restoration, reporting) is outside the tool's scope.

**If no custom cost:**
```
si_avoided = (baseline_si_hours[size] - with_tool_si_hours[size]) × external_si_rate
```
Default hours by size: Small 40→8, Medium 80→16, Large 160→32, Enterprise 320→64.

### Probability-adjusted annual value

```
total_event_value = disruption_avoided + labor_avoided + si_avoided
expected_annual_value = total_event_value × incident_probability (default 5%)
```

**The 5% default is deliberately conservative.** Broader ransomware data shows 59% of organizations experienced an attack (Sophos, 2024) and 44% of breaches involved ransomware (Verizon DBIR, 2025). The 5% reflects only the subset of incidents severe enough to require full AD forest recovery — not all ransomware events escalate to this level.

### ROI and payback

```
roi_percent = ((annual_value - product_annual_cost) / product_annual_cost) × 100
payback_months = product_annual_cost / (annual_value / 12)
```

---

## 7. TCO Model

**File:** `src/lib/tcoModel.ts`

The TCO section is optional and rendered when the user expands the TCO Assumptions accordion. It calculates non-license ownership costs.

### Components

| Component | Default | Notes |
|-----------|---------|-------|
| Infrastructure | $1,500/yr | Single VM + SQL DB; flat rate regardless of size |
| Storage | $120–$600/yr by size | AD backups ≤ 500 GB even in large environments |
| Admin FTE overhead | 2–25% FTE by size | Fraction of one FTE for monitoring, testing, maintenance |
| Annual restore testing | 8–40 hrs/yr by size | Labor cost at internal_ir_hourly_rate |

### FTE defaults by size

| Size | FTE % | Hours/yr | Approx hrs/month |
|------|--------|----------|-----------------|
| Small | 2% | 42 | ~3.5 |
| Medium | 7% | 146 | ~12 |
| Large | 15% | 312 | ~26 |
| Enterprise | 25% | 520 | ~43 |

### License handling

The license cost is computed internally and factored into `total_annual_tco` but is **never displayed as a line item** in either the live calculator or the PDF export. This prevents customers from reverse-engineering the license price from the Total Annual TCO and the visible components.

**The displayed subtotal is `non_license_annual_subtotal`** (infra + storage + FTE + restore testing) — not the full TCO total.

---

## 8. Input Schema

**File:** `src/types/roi.ts`

```ts
interface ROIInputs {
  tier: 'tier1' | 'tier2';
  tier1: Tier1Inputs;
  tier2: Tier2Overrides;   // all fields nullable — only overrides, not replacements
  tco:   TCOInputs;
}
```

### Tier1Inputs (required fields)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `employees_total` | number | 0 | Required to enable Calculate |
| `environment_size` | `'small'\|'medium'\|'large'\|'enterprise'` | `'medium'` | — |
| `recovery_readiness` | `'limited'\|'developing'\|'mature'` | `'developing'` | — |
| `incident_probability_per_year` | number | 0.05 | Overrideable in Tier 2 |
| `annual_revenue_usd` | number \| null | null | Optional; drives revenue disruption model |
| `external_si_engaged` | boolean | false | Toggles SI cost avoidance calculation |
| `external_si_estimated_cost_usd` | number \| null | null | Optional; uses default hours if null |

### Tier2Overrides (all nullable)

| Field | Type | Effect |
|-------|------|--------|
| `dc_count` | number | Scales DC restoration phases via sqrt factor |
| `backup_frequency` | `'daily'\|'weekly'\|'other'` | Contributes to composite readiness score |
| `runbook_exists` | boolean | Contributes to composite readiness score |
| `staff_experience` | `'none'\|'1-2'\|'3+'` | Contributes to composite readiness score |
| `last_restore_test` | `'never'\|'over_1yr'\|'within_1yr'\|'within_quarter'` | Contributes to composite readiness score |
| `segregated_env_available` | boolean | Contributes to composite readiness score |
| `workforce_impact_percent` | number | Overrides default 85% |
| `fully_loaded_hourly_rate_usd` | number | Overrides default $65 |
| `internal_ir_hourly_rate_usd` | number | Overrides default $125; also used for TCO FTE rate |
| `external_si_hourly_rate_usd` | number | Overrides default $250 |
| `product_annual_cost_usd` | number | Overrides per-user pricing for custom contracts |
| `incident_probability_per_year` | number | Overrides default 5% |

### TCOInputs (all nullable — null uses config default)

| Field | Type | Notes |
|-------|------|-------|
| `infrastructure_annual_usd` | number \| null | Default: $1,500 |
| `storage_annual_usd` | number \| null | Default: size-based |
| `fte_admin_fraction` | number \| null | Default: size-based (0.02–0.25) |

---

## 9. Output Schema

**File:** `src/types/roi.ts`

```ts
interface ROIOutputs {
  time:        TimeOutputs;
  dollars:     DollarOutputs;
  assumptions: AssumptionSnapshot;
  tco?:        TCOOutputs;        // undefined if not rendered
  is_complete: boolean;
}
```

### TimeOutputs

| Field | Type | Notes |
|-------|------|-------|
| `baseline_elapsed_hours` | RangeValue | Sum of all phase baseline hours |
| `with_tool_elapsed_hours` | RangeValue | Sum of all phase with-tool hours |
| `time_saved_hours` | RangeValue | baseline − with-tool |
| `time_saved_percent` | RangeValue | (saved / baseline) × 100 |
| `baseline_elapsed_days` | RangeValue | hours ÷ 8 working hrs/day |
| `with_tool_elapsed_days` | RangeValue | hours ÷ 8 working hrs/day |
| `phases` | PhaseResult[] | Per-phase detail for the bar chart |

### DollarOutputs

| Field | Type | Notes |
|-------|------|-------|
| `business_disruption_avoided` | RangeValue | Revenue or labor driver |
| `disruption_driver` | `'revenue'\|'labor'` | Determines row label in results |
| `recovery_team_labor_avoided` | RangeValue | IR team hours × rate × team size |
| `external_services_avoided` | RangeValue | SI cost avoidance (0 if not engaged) |
| `total_event_value` | RangeValue | Sum of above three |
| `incident_probability` | number | Resolved probability (Tier2 override or default) |
| `expected_annual_value` | RangeValue | total × probability |
| `roi_percent` | RangeValue | ((annual − cost) / cost) × 100 |
| `payback_period_months` | RangeValue | cost / (annual / 12) |

### TCOOutputs

| Field | Type | Notes |
|-------|------|-------|
| `infrastructure_annual` | number | — |
| `storage_annual` | number | — |
| `fte_admin_annual` | number | — |
| `restore_test_annual` | number | — |
| `non_license_annual_subtotal` | number | **The displayed total** — excludes license |
| `total_annual_tco` | number | Includes license — used internally only |
| `tco_roi_percent` | RangeValue | Computed but not currently displayed |
| `tco_payback_months` | RangeValue | Computed but not currently displayed |
| `resolved` | object | `{ fte_admin_fraction, fte_admin_hourly_rate, restore_test_hours }` |

---

## 10. URL State and Shareability

**File:** `src/lib/urlState.ts`

All Tier 1 and TCO inputs are serialized to URL query parameters (debounced 400ms). This makes any calculator state fully shareable via a link. The "Copy shareable link" button copies `window.location.href`.

### URL parameter map

| Param | Field | Example |
|-------|-------|---------|
| `emp` | employees_total | `emp=5000` |
| `size` | environment_size | `size=large` |
| `ready` | recovery_readiness | `ready=developing` |
| `prob` | incident_probability_per_year | `prob=0.10` (only if non-default) |
| `rev` | annual_revenue_usd | `rev=500000000` |
| `si` | external_si_engaged | `si=1` |
| `sicost` | external_si_estimated_cost_usd | `sicost=150000` |
| `tier` | tier | `tier=2` |
| `tco_inf` | infrastructure_annual_usd | `tco_inf=2000` |
| `tco_sto` | storage_annual_usd | `tco_sto=480` |
| `tco_fte` | fte_admin_fraction | `tco_fte=0.15` |

**Note:** Tier 2 override fields are not currently serialized to URL. A prospect sharing a URL from Tier 2 will need to re-enter those fields. This is a known gap.

---

## 11. UI Components

### ROICalculator.tsx

Root component. Owns all state. Key behaviors:
- URL state hydration on mount (reads params before React default state)
- Inputs change → clears previous results (stale prevention)
- Calculate button → calls `calculate(inputs)` and stores in `submittedOutputs`
- Smooth-scrolls to results after calculate
- Copy link button appears once employee count is entered

### Tier1Form.tsx

Basic inputs. Uses card-selector pattern for environment size and readiness (visually prominent, single-select, no dropdown). Revenue field includes contextual guidance explaining why it matters when AD goes down. SI toggle reveals an optional cost input when enabled.

### Tier2Form.tsx

Advanced overrides organized into three collapsible sections:
- **Environment Detail** — DC count (scales DC restoration phases)
- **Recovery Readiness Detail** — five fields that drive composite readiness scoring
- **Cost Assumptions** — six overrideable rate fields

All fields are optional. Any set field overrides the calculated default; unset fields inherit Tier 1 proxies.

### TCOForm.tsx

Collapsible accordion (closed by default). Three overrideable fields with size-contextual placeholder values. Includes a note that FTE rates are inherited from Cost Assumptions and that training is provided free.

### ResultsPanel.tsx

Renders the full results view:
- **Hero metric cards** — Baseline recovery, with-tool recovery, time saved %, expected annual value
- **Phase breakdown bar chart** — Per-phase bars comparing baseline vs. with-tool
- **Financial impact table** — Disruption avoided, labor avoided, SI avoided, event total, probability-adjusted annual value, ROI, payback
- **TCO section** — Non-license overhead breakdown and subtotal
- **Probability note** — Explains the 5% default with Sophos/Verizon DBIR citations
- **Overhead callout** — Daily non-license overhead cost
- **Scope disclaimer** — What the calculator covers and what it doesn't

Time display logic: values < 24 hours display as `Xh`; values ≥ 24 hours display as `X.Xd` (calendar days ÷ 24, not working days).

### ExportSummary.tsx

Manages the PDF export flow:
1. "Download PDF Summary" button triggers the form
2. Prospect enters name, email, company
3. On submit: builds a complete self-contained HTML document and opens it in a popup via `window.open`
4. Print dialog fires after 1.2 seconds (allows Google Fonts to load)

The export HTML is entirely inline-styled (no external CSS except Google Fonts) for print compatibility.

---

## 12. Export / PDF Summary

The print document layout (top to bottom):

| Section | Notes |
|---------|-------|
| Header | Netwrix branding, "Your Identity Recovery ROI Summary", date, "Prepared for" box (if name/company provided) |
| Blue accent bar | 4px brand separator |
| Time metric cards | 3-up grid: Baseline, With Tool, Time Saved |
| Executive summary | Second-person paragraph summarizing the full result |
| Financial value cards | 3-up: Expected Annual Value, Estimated ROI, Payback Period |
| Your Environment + Detailed Results | Side-by-side 2-column layout |
| Assumptions Used | 4-up card grid: Workforce Impact, Employee Rate, IT/IR Rate, SI Rate |
| Your Non-License Ownership Costs | TCO breakdown (conditional — shown only if TCO section was used) |
| Legal disclaimer | Full Netwrix legal disclaimer (required by Legal) |
| CTA | Call to action to speak with a rep |
| Footer | Methodology note (includes 5% conservative note), Sources, copyright |

**Pricing protection:** The license cost is never shown. `non_license_annual_subtotal` is displayed; `total_annual_tco` is not. External Services Avoided row is conditionally rendered (only shown when SI is engaged and amount > 0) to avoid displaying $0 rows.

---

## 13. Key Design Decisions

### Single expected value (no ranging)

The calculator displays a single expected value for all outputs. The `RangeValue` type is retained internally but all three fields are set identically via `scalar(n)`. The previous double-ranging approach (phase min/max × cost multipliers) produced a ~4× spread that was confusing and undermined credibility.

### Revenue as sole disruption driver (not additive)

When annual revenue is provided, it **replaces** the workforce labor calculation entirely. The two drivers answer the same question from different lenses — adding them would double-count disruption cost. Revenue is the preferred driver when available because it captures the full organizational impact rather than just IT labor.

### Credential hygiene as fixed overhead

The credential hygiene phase appears identically in both baseline and with-tool scenarios. This is intentional and honest — Identity Recovery does not automate this work. Showing equal time in both scenarios accurately represents the tool's scope boundary.

### License cost not displayed

Displaying the license as a line item alongside the non-license TCO components would allow customers to derive the license cost by subtracting the visible subtotal from the total. The solution: display `non_license_annual_subtotal` only, remove `total_annual_tco` from all customer-facing surfaces. Full-TCO ROI and Payback metrics are also omitted for this reason.

### 5% incident probability default

Deliberately conservative. Broader ransomware data (59% of orgs, Sophos 2024; 44% of breaches, Verizon DBIR 2025) is not the right denominator — most ransomware events do not require full AD forest recovery. The 5% (≈ once per 20 years) reflects only the most severe subset. Prospects can adjust this in Tier 2 Cost Assumptions.

### "You" language throughout

All customer-facing text uses second-person framing ("your financial impact", "your estimated recovery time", "your environment") to make the calculator feel personalized rather than generic. Row-level labels within already-personalized sections do not use "Your" prefix to avoid redundancy.

---

## 14. How to Maintain and Update

### Updating phase hour ranges

Edit `roiConfig.json → phases[*].baseline_hours_by_size` and `with_tool_hours_by_size`. Each value is `[conservative_hours, aggressive_hours]`; the model takes the midpoint as expected.

### Adding a new phase

1. Add the phase object to `roiConfig.json → phases` with all required fields
2. Set `tool_benefit: false` if the tool provides no improvement for that phase
3. No TypeScript changes required — the model iterates `config.phases` dynamically

### Updating cost defaults

Edit `roiConfig.json → defaults`. Key fields: `workforce_impact_percent`, `productivity_loss_factor`, `fully_loaded_hourly_rate_usd`, `internal_ir_hourly_rate_usd`, `external_si_hourly_rate_usd`, `product_cost_per_user_usd`, `incident_probability_default`.

### Updating TCO defaults

Edit `roiConfig.json → tco_defaults`. FTE fractions by size, storage costs, restore test hours, and infrastructure cost are all here.

### Changing the SI savings factor

In `src/lib/dollarConversion.ts`, the value `0.35` on the line:
```ts
ext_avoided = tier1.external_si_estimated_cost_usd * 0.35;
```
This represents the AD forest recovery portion of a full IR engagement. Adjust if scoping changes.

### Running the test suite

```bash
node --input-type=module tests/roi-scenarios.mjs
```

The suite covers 25 scenarios across all environment sizes, readiness levels, revenue/labor drivers, SI engagement, Tier 2 overrides, and edge cases. Key validation checks at the end:
- Credential hygiene savings = 0% across all scenarios (no negative savings)
- Small org TCO is reasonable (≤$15K non-license)
- Enterprise ROI is positive at default risk

### Updating the model version

Bump `roiConfig.json → meta.config_version` and `meta.last_calibrated_date` when recalibrating phase hours or changing material defaults. The version is tracked internally in `AssumptionSnapshot` for debugging.

### Building and deploying

```bash
npm run dev        # local dev server (port 4321)
npm run build      # production static build → dist/
npm run preview    # preview the production build
```

The output is a fully static site (`dist/`) with no server requirements.

---

## 15. Known Limitations and Caveats

### Tier 2 inputs not serialized to URL

Tier 2 override fields (DC count, readiness detail, cost rates) are not included in the shareable URL. A rep who enters Tier 2 data cannot share a pre-filled link that includes those values. Tier 1 and TCO fields are fully serialized.

### Revenue model assumes 100% of revenue is at risk

The revenue-per-hour calculation divides annual revenue by working hours and assumes the full amount is at risk during an outage. For businesses with offline transactions, deferred billing, or partial-availability scenarios, this may overstate disruption. The revenue field includes guidance text explaining this; prospects can adjust by entering a lower revenue figure.

### Extreme revenue inputs produce large numbers

A $10B revenue organization at 20% risk will produce a very large expected annual value. The model is mathematically correct for the inputs given; this is a sales conversation, not a model problem. The 5% default probability is designed to moderate most scenarios.

### Working days vs. calendar days

Phase hours are defined in terms of elapsed recovery time (24-hour clock), but the revenue-per-hour calculation uses working days (250 × 8 hrs). This is intentional: AD recovery runs around the clock, but revenue exposure is based on operating hours. Time display in the UI uses calendar day conversion (÷ 24).

### No Tier 2 readiness for `domain_count`, `site_count`

The `domain_count` and `site_count` fields exist in the `Tier2Overrides` type and in URL defaults but are not currently wired to any calculation. They are orphaned fields retained for potential future use. They are not displayed in the Tier 2 form.

### Print dialog timing

The export triggers `window.print()` after a 1.2-second delay to allow Google Fonts to load. On slow connections, fonts may not load in time and the PDF will fall back to system sans-serif. This is a known trade-off of the client-side print approach.

---

## 16. Benchmark Calibration Notes

This section documents the rationale and sourcing behind each key default value. When recalibrating, update both `roiConfig.json` and this section so the reasoning stays traceable.

### Incident probability — 5% default

The 5% annual probability (~once per 20 years) represents only incidents severe enough to require a full AD forest recovery, not all ransomware events. This is deliberately conservative.

Context from industry data:
- Sophos *State of Ransomware 2024*: 59% of organizations were hit by ransomware in the prior year. This is the broadest denominator — any ransomware hit, any severity.
- Verizon *Data Breach Investigations Report 2025*: ransomware or extortion was present in 44% of breaches analyzed. Again, a broad denominator covering all breach types.
- Neither figure is the right input for this calculator. Most ransomware events are contained before they compromise the full directory; many are recovered from backup without needing forest-level rebuild. The 5% is an internal Netwrix estimate of the subset that escalates to full forest recovery.

Preset levels in the config:

| Label | Value | Rationale |
|-------|-------|-----------|
| Low | 2% | ~once per 50 years; strong controls, no prior incidents |
| Moderate | 5% | ~once per 20 years; average enterprise (default) |
| Elevated | 10% | ~once per 10 years; known gaps or prior AD incidents |
| High | 20% | ~once per 5 years; active threat exposure or recent breach |

### Employee fully loaded rate — $65/hr

Sourced from US Bureau of Labor Statistics (BLS) Employer Costs for Employee Compensation (ECEC), which reports total compensation (wages + benefits) across all civilian workers. The $65/hr figure represents a blended rate across all employee types in a typical enterprise. This is the cost to the organization per employee-hour, not a wage figure. Updated periodically from BLS ECEC tables (quarterly release).

### Internal IT/IR hourly rate — $125/hr

Blended rate for a small team of AD engineers and security operations staff handling the recovery. Calibrated from:
- BLS Occupational Employment and Wage Statistics (OEWS): Information Security Analysts ($60–75/hr loaded), Systems Administrators ($45–60/hr loaded)
- Incident response retainer market benchmarking: enterprise IR retainer pricing implies $150–200/hr for dedicated AD recovery work
- $125/hr represents the blended "internal team covering the recovery" scenario, not dedicated IR specialists

### External SI/IR rate — $250/hr

Calibrated from publicly available enterprise IR retainer and statement-of-work pricing:
- Big-4 and Tier-1 IR firms typically bill $275–400/hr for senior incident responders
- Boutique AD-specialist IR firms: $200–300/hr
- $250/hr represents a mid-market enterprise engagement rate for AD forest recovery work, not a general consulting rate

### External SI savings factor — 35%

When a prospect provides their total estimated SI/IR engagement cost, only 35% is attributed to Identity Recovery's benefit. This reflects that an AD forest recovery engagement typically involves:
- ~30–40% of scope: actual AD rebuild and validation (automated by Identity Recovery)
- ~60–70% of scope: credential hygiene, forensics, threat actor eviction, dependent service restoration, executive reporting — all outside the tool's scope

The 35% is conservative midpoint of the 30–40% range. When no custom SI cost is provided, the calculator instead uses the per-size default hours delta (baseline SI hours minus with-tool SI hours) × the SI rate.

### Workforce impact — 85%

When AD goes down, 85% of employees are estimated to be meaningfully impacted (loss of access to AD-authenticated resources: file shares, email on-prem, VPN, applications, workstations). The remaining 15% may be unaffected due to:
- Cached credentials allowing temporary local login
- Roles that do not depend on networked AD-authenticated resources
- Mobile-first workers already on cloud-only tooling

This figure is conservative; some organizations report near-100% impact in full forest recovery scenarios. Overrideable in Tier 2.

### Productivity loss factor — 40%

Of the 85% impacted employees, they are not 100% non-productive. Estimated 40% productivity loss accounts for:
- Offline work (local files, mobile, offline email)
- Manual workarounds and verbal/paper processes
- Partial cached-credential access

This 40% loss factor on 85% impact yields an effective organizational productivity loss of ~34% during an outage. This aligns with business continuity research on workforce productivity during IT outages (e.g., Forrester Total Economic Impact studies for enterprise DR tools typically model 20–50% workforce impact).

### Recovery team sizing

| Size | Team | Rationale |
|------|------|-----------|
| Small (≤500 emp) | 2 | 1 AD admin + 1 security/IT lead |
| Medium (500–2K) | 4 | AD team lead + 1–2 engineers + security analyst |
| Large (2K–10K) | 6 | AD team + dedicated IR lead + security ops |
| Enterprise (10K+) | 10 | Full AD team + security operations + external coordination |

These represent the humans actively working the recovery — not total IT staff. Calibrated from Netwrix field experience with customer recovery exercises and post-incident reviews.

### Phase hour ranges

Phase hour ranges (`[min, max]` per size) are calibrated from:
- Netwrix field experience with AD forest recovery exercises across customer environments
- Public incident reports and post-mortems (NotPetya, various healthcare ransomware incidents) where AD recovery timelines were documented
- Microsoft AD recovery guidance (recovery time estimates for DC restore + replication convergence by DC count)
- The midpoint of `[min, max]` is used as the expected value; the range captures variability in environment complexity

The `tool_benefit` multipliers (baseline ÷ with-tool) are validated against Netwrix lab benchmarks and customer recovery exercise data comparing manual vs. Identity Recovery-assisted procedures.

### TCO infrastructure cost — $1,500/yr

Flat rate for a single Windows Server VM running the Identity Recovery application and its SQL database. Based on:
- On-premises: ~1–2 vCPUs, 8 GB RAM, 100 GB disk — negligible incremental cost if on existing VMware/Hyper-V
- Azure IaaS equivalent: B2s or D2s_v3 ~$70–120/mo depending on region and reserved pricing
- $1,500/yr ($125/mo) represents a conservative cloud VM cost; on-prem orgs will typically see lower TCO here

### TCO storage cost — $120–$600/yr by size

Identity Recovery requires at most ~500 GB for AD backup snapshots even in large environments (AD database is typically 20–80 GB per DC; snapshots with history are bounded). Storage costs:
- On-premises: nearly zero incremental if existing SAN/NAS has capacity
- Cloud blob storage at ~$0.02/GB/mo: 500 GB = $10/mo = $120/yr (upper bound)
- The size-based defaults ($120/$240/$360/$600) reflect increased snapshot retention and redundancy expectations at larger scales

### TCO admin FTE overhead

| Size | FTE % | Rationale |
|------|--------|-----------|
| Small | 2% | ~42 hrs/yr; quarterly check + annual test |
| Medium | 7% | ~146 hrs/yr; monitoring, monthly review, annual DR test |
| Large | 15% | ~312 hrs/yr; active monitoring, quarterly tests, runbook maintenance |
| Enterprise | 25% | ~520 hrs/yr; dedicated partial role for AD security and recovery readiness |

These are calibrated from Netwrix professional services experience with customer deployments. Overrideable in the TCO Assumptions accordion.

---

## 17. Sources & References

### Ransomware & Breach Data

| Source | Finding used | URL |
|--------|-------------|-----|
| Sophos *State of Ransomware 2024* | 59% of organizations were hit by ransomware in 2023 | sophos.com/en-us/content/state-of-ransomware |
| Verizon *Data Breach Investigations Report 2025* | Ransomware or extortion present in 44% of breaches | verizon.com/business/resources/reports/dbir |

### Labor & Compensation Data

| Source | Finding used | URL |
|--------|-------------|-----|
| US Bureau of Labor Statistics — Employer Costs for Employee Compensation (ECEC) | Basis for $65/hr fully loaded employee rate | bls.gov/ect |
| US Bureau of Labor Statistics — Occupational Employment and Wage Statistics (OEWS) | Basis for $125/hr internal IT/IR rate calibration | bls.gov/oes |

### Incident Response Market Benchmarks

| Source | Finding used |
|--------|-------------|
| Enterprise IR retainer pricing (Tier-1 IR firms, publicly available SOW ranges) | Basis for $250/hr external SI rate |
| Netwrix field data — post-incident reviews and recovery exercises | Recovery team sizing; phase hour ranges; tool benefit multipliers |

### Microsoft Documentation

| Source | Finding used | URL |
|--------|-------------|-----|
| Microsoft — *AD DS Backup and Recovery* | DC restore and replication convergence time guidance; informs phase hour ranges | learn.microsoft.com/windows-server/identity/ad-ds/manage/ad-forest-recovery-guide |

### Business Continuity Research

| Source | Finding used |
|--------|-------------|
| Forrester *Total Economic Impact* methodology (general) | Framework for productivity loss factor (40%) and workforce impact (85%) calibration |
| Public post-incident reports (NotPetya 2017, various healthcare ransomware 2020–2024) | Calibration reference for full AD forest recovery timelines |

### Calibration ownership

The model is owned by Netwrix Product Marketing. Recalibration of phase hours and cost rates should be reviewed by:
- **Product Management** — for tool benefit multipliers and phase scope accuracy
- **Field/Sales Engineering** — for customer environment sizing and recovery team benchmarks
- **Legal** — for any changes to the methodology that affect the disclaimer language in the export

Questions about specific benchmark values should be directed to the product manager responsible for Identity Recovery.
