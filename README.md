# Identity Recovery ROI Calculator

A sales enablement tool that estimates the financial return on investment from deploying Netwrix Identity Recovery to reduce Active Directory forest recovery time after a ransomware, wiper, or domain compromise event.

Built with Astro 6, React 19, TypeScript, and Tailwind CSS v4.

---

## What It Does

The calculator produces three categories of output:

- **Recovery time savings** — how much faster AD forest recovery is with Identity Recovery vs. manual recovery, broken down by phase
- **Per-incident financial value** — the dollar value of that time savings (workforce productivity, recovery team labor, external services)
- **Expected Annual Value** — probability-adjusted annualized ROI, accounting for the likelihood of a forest recovery event occurring in any given year

All outputs are presented as Conservative / Expected / Aggressive ranges. Results are exportable as a branded PDF executive summary.

---

## Financial Model

The calculator uses a five-phase recovery time model calibrated against AD recovery engagement data:

1. Containment & Decision to Restore
2. Restore Domain Controllers
3. Re-establish Core AD Services
4. Credential Hygiene *(manual — not automated by Identity Recovery)*
5. Validation & AD Operational

Financial value is calculated using a probability-adjusted Expected Annual Value model:

```
Expected Annual Value = Per-Incident Value × Annual Incident Probability
ROI = (Expected Annual Value − Annual Product Cost) / Annual Product Cost
```

See [ROI_CALCULATOR_METHODOLOGY.md](ROI_CALCULATOR_METHODOLOGY.md) for full methodology, assumptions, cited sources, and worked examples.

---

## Getting Started

**Prerequisites:** Node.js ≥ 22.12.0

```sh
# Install dependencies
npm install

# Start local dev server
npm run dev
# → http://localhost:4321

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```
src/
├── components/
│   ├── ROICalculator.tsx      # Top-level orchestrator, state management
│   ├── Tier1Form.tsx          # Quick estimate form (3 required inputs)
│   ├── Tier2Form.tsx          # Detailed assumption overrides
│   ├── ResultsPanel.tsx       # Phase breakdown + financial table
│   └── ExportSummary.tsx      # Branded PDF export
├── lib/
│   ├── phaseModel.ts          # Recovery phase time engine
│   ├── dollarConversion.ts    # Financial calculations (EAV, ROI, payback)
│   ├── roiEngine.ts           # Orchestrates phase model → dollar model
│   ├── urlState.ts            # URL param encoding/decoding for shareable links
│   └── analytics.ts           # Event tracking
├── config/
│   └── roiConfig.json         # All calibration data, defaults, phase hours
├── types/
│   └── roi.ts                 # TypeScript interfaces
├── pages/
│   └── index.astro            # Page shell
└── styles/
    └── global.css             # Netwrix brand tokens, typography
```

---

## Configuration

All financial defaults and phase calibration data live in [`src/config/roiConfig.json`](src/config/roiConfig.json). This is the single source of truth for:

- Recovery phase hour ranges by environment size
- Readiness multipliers
- Workforce and cost assumption defaults
- Incident probability levels
- Product cost per user

No environment variables are required to run this project.

---

## Methodology & Assumptions

See [ROI_CALCULATOR_METHODOLOGY.md](ROI_CALCULATOR_METHODOLOGY.md) for a complete explanation of:

- All five recovery phases and what drives their time estimates
- Every financial assumption with its default value and source citation
- The probability-adjusted Expected Annual Value model and why it's used
- Conservative / Expected / Aggressive range methodology
- Competitive context and how this compares to the Semperis Forrester TEI
- Limitations and honest caveats

---

## License

Copyright (c) 2026 Netwrix Corporation. All rights reserved.
See [LICENSE](LICENSE) for details.
