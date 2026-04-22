# Identity Recovery ROI Calculator — User Guide

> For sales reps, SEs, and prospects using the calculator for the first time.

---

## What this tool does

The Identity Recovery ROI Calculator estimates the financial value of deploying Netwrix Identity Recovery to reduce Active Directory forest recovery time after a ransomware, wiper, or domain compromise event.

In under two minutes you get:
- How much faster AD recovery is with Identity Recovery vs. manual
- The dollar value of that time savings if an incident occurs
- A probability-adjusted expected annual value and ROI
- A downloadable branded PDF to share with an economic buyer

---

## Quick start — the 2-minute version

Open the calculator and fill in four fields. Everything else has sensible defaults.

---

## Step 1 — Enter your environment basics

![Form — top section](screenshots/01-form-top.png)

**Total Employees** — Enter the total headcount of the organization. This drives workforce disruption cost (how much an outage costs per hour in lost productivity) and the license cost baseline used for ROI.

**Active Directory Environment Size** — Pick the card that best describes your AD footprint:

| Size | DCs | Domains | Locations |
|------|-----|---------|-----------|
| Small | Up to 5 | 1 | 1–3 |
| Medium | 6–20 | Up to 3 | 4–10 |
| Large | 21–60 | 3–8 | 10–30 |
| Enterprise | 60+ | 8+ | 30+ |

When in doubt, go one size smaller rather than larger — the calculator will still be defensible.

**Recovery Readiness** — This is how prepared the organization's team is *today* for an AD forest recovery. It affects baseline recovery time (unprepared teams take longer):
- **Limited** — No runbook, backups rarely tested, fewer than 2 experienced staff
- **Developing** — Some documentation, backups tested over a year ago, 1–2 experienced staff
- **Mature** — Documented runbook, tested within the year, 3+ experienced staff

---

## Step 2 — Add revenue and SI (optional but high-impact)

![Form — revenue and SI section](screenshots/02-form-filled.png)

**Annual Revenue** — Even an approximation matters. Without it, the calculator can only count IT labor saved, which understates the real business impact by 5–10× for most companies. When AD is down, revenue-generating operations stop. Use fiscal year revenue or a close estimate.

> **Tip for reps:** If the prospect is reluctant to share revenue, try "even a rough order of magnitude helps — $500M or $1B?" An approximation is far better than nothing.

**External IR / Recovery Firm** — If the organization would engage an external services firm during a major incident, toggle this to **Yes** and enter the estimated full engagement cost if known. The calculator automatically applies a 35% savings factor (reflecting the AD forest recovery portion of a full IR engagement). Leave the cost blank to use a default estimate based on environment size.

---

## Step 3 — Calculate

Scroll down and click **Calculate My ROI**. Results appear immediately below the form.

---

## Step 4 — Read the results

![Results — hero metrics and phase breakdown](screenshots/03-results-hero.png)

**The four headline metrics:**

| Metric | What it means |
|--------|--------------|
| Baseline Recovery | How long AD recovery takes today without Identity Recovery |
| With Identity Recovery | Estimated recovery time with the tool |
| Time Saved | Percentage faster (and absolute hours/days saved) |
| Expected Annual Value | Probability-adjusted dollar value per year |

**Recovery Phase Breakdown** — Shows where time is saved across the five recovery phases. Green bars = with Identity Recovery, grey bars = without. Note that **Credential Hygiene** is equal in both scenarios — this is intentional. Identity Recovery doesn't automate KRBTGT rotation or privileged account resets; that work happens regardless.

---

## Step 5 — Review the financial detail

![Results — financial impact and TCO](screenshots/04-results-financial.png)

**Your Financial Impact** breaks down the value into three components:

- **Revenue at Risk Avoided** — Revenue the business doesn't lose because recovery is faster (only shown when revenue was entered; replaces the labor driver)
- **Recovery Team Labor Avoided** — IT/IR team hours saved × internal hourly rate × team size
- **External Services Avoided** — Reduction in SI/IR firm engagement cost (only shown when SI was selected and amount > 0)
- **Total If Incident Occurs** — The sum of all avoided costs if a breach requiring full AD recovery happens
- **Expected Annual Value** — Total × 5% default incident probability (one-in-twenty-years conservative estimate)
- **ROI** and **Payback Period** — Calculated against the software investment

**Your Total Cost of Ownership** (shown when TCO section is used) — Non-license annual overhead: infrastructure, storage, admin FTE time, and annual restore testing. The software license cost is factored into ROI/payback but is not shown as a line item.

> **The 5% probability note:** The calculator defaults to 5% annual probability — roughly once per 20 years. This is deliberately conservative; it reflects only the subset of ransomware incidents severe enough to require full AD forest recovery. If the customer has had a prior AD incident or has known security gaps, increasing this to 10–20% in the detailed assumptions is well-justified.

---

## Step 6 — Export the PDF

![Results — export and CTA](screenshots/05-results-export.png)

Click **Download PDF Summary**. You'll be prompted for a name, email, and company name (optional — used for the "Prepared for" header in the PDF). A branded summary document opens and the print dialog fires automatically.

The PDF includes:
- All headline metrics
- Executive summary paragraph
- Financial breakdown table
- TCO breakdown (if used)
- Full Netwrix legal disclaimer
- Call to action and methodology notes

---

## Advanced: Customize assumptions

Click **+ Customize assumptions** to unlock detailed overrides. Any field left blank inherits the default from your Tier 1 selections.

![Advanced — environment and readiness detail](screenshots/06-advanced-assumptions.png)

**Environment Detail**
- **Domain Controller Count** — If you know the exact DC count, enter it. This scales the DC restoration and core AD phases using a square-root factor (more DCs = more time, but with diminishing returns due to parallelism).

**Recovery Readiness Detail** — Five fields that replace the simple Limited/Developing/Mature proxy with a composite score:
- Backup frequency (daily, weekly, other)
- Documented AD recovery runbook (yes/no)
- Last backup restore test (never → within last quarter)
- Staff with AD recovery experience (none → 3+)
- Segregated recovery environment available (yes/no)

When any of these are set, they override the Tier 1 readiness card selection.

---

![Advanced — cost assumptions](screenshots/07-cost-assumptions.png)

**Cost Assumptions** — Override any of the six cost rate defaults:

| Field | Default | When to override |
|-------|---------|-----------------|
| Workforce Impact % | 85% | Lower for cloud-heavy orgs with cached-credential access |
| Fully Loaded Employee Hourly Cost | $65/hr | Use org's actual fully loaded cost if known |
| Internal IT / IR Hourly Rate | $125/hr | Use actual blended IR team rate |
| External SI Hourly Rate | $250/hr | Use actual SOW rate if known |
| Annual Product Cost Override | $12.50 × employees | Use only for custom contract pricing |
| Annual Incident Probability | 5% | Raise for orgs with prior incidents or known gaps |

---

![TCO assumptions panel](screenshots/08-tco-assumptions.png)

**TCO Assumptions** — Collapsed by default. Expand to override non-license ownership cost inputs:

| Field | Default | Notes |
|-------|---------|-------|
| Infrastructure Cost | $1,500/yr | Single VM + SQL DB; near-zero for on-prem if spare capacity exists |
| Storage Cost | $120–$600/yr by size | AD backups ≤ 500 GB even in large environments |
| Admin FTE Overhead | 2–15% FTE by size | Time for monitoring, testing, maintenance |

FTE and restore-test labor rates inherit from the Cost Assumptions rate above.

---

## Worked example

**Scenario:** A healthcare organization with 3,500 employees, a large AD environment (30 DCs, 5 domains, 12 locations), developing recovery readiness, $750M annual revenue, and an external IR firm on retainer.

**Inputs entered:**
- Total Employees: 3,500
- Environment Size: Large
- Recovery Readiness: Developing
- Annual Revenue: $750,000,000
- External IR: Yes — $200,000 estimated engagement cost

**Results:**

| Metric | Value |
|--------|-------|
| Baseline Recovery | 4.4 days |
| With Identity Recovery | 1.8 days |
| Time Saved | 60% (~2.6 days faster) |
| Revenue at Risk Avoided | $23,831,250 |
| Recovery Team Labor Avoided | $47,663 |
| External Services Avoided | $70,000 |
| Total If Incident Occurs | $23,948,913 |
| Expected Annual Value (at 5%) | $1,197,446 |
| ROI | 2,637% |
| Payback Period | 0.4 months |
| Non-License Annual Overhead | $43,860 |

**Shareable link:** After entering inputs, the URL updates automatically. Click **Copy shareable link** to capture the pre-filled state and share with a colleague or follow up after a call.

---

## Tips for rep-assisted demos

**Lead with the phase breakdown chart.** It makes the value concrete — prospects can see exactly where time is saved and immediately understand that credential hygiene (same in both scenarios) is the honest part of the model, which builds credibility.

**The 5% conversation.** If a prospect pushes back on the expected annual value seeming low, explain the 5% default — it's once per 20 years. Ask: "Has your organization had an AD incident in the last five years?" If yes, bump it to 10–20%.

**Revenue vs. labor.** If a prospect hesitates to enter revenue, use the labor-only result first, then show what happens when even a rough revenue figure is added. The contrast is often compelling enough on its own.

**Use Tier 2 for discovery.** Filling out the readiness detail fields together with the prospect turns the calculator into a recovery readiness conversation. Each question surfaces gaps they may not have considered.

**The TCO section is optional but useful for IT buyers.** Finance and procurement sometimes want to understand total ownership cost, not just ROI. Expanding TCO gives them the non-license overhead in one place without revealing license pricing.

---

## Common questions

**Why is Credential Hygiene the same in both scenarios?**
Identity Recovery automates the AD forest rebuild — restoring domain controllers, replication, SYSVOL, DNS, and FSMO roles. It does not automate KRBTGT rotation, privileged account resets, or service account remediation. That work is the same regardless of whether the tool is used, so the calculator shows it as identical in both scenarios. This is intentional honesty, not a limitation of the model.

**Why does the tool show calendar days, not working days?**
AD forest recovery runs around the clock — teams don't stop at 5pm during a major incident. All phase hours and display values use elapsed calendar time (÷ 24 hours/day), not working days.

**Can I share my results?**
Yes. The URL updates automatically as you fill in the form. Click **Copy shareable link** to copy the current URL with all your inputs pre-filled. Note: Tier 2 (detailed assumptions) fields are not currently saved to the URL — only Tier 1 and TCO values are.

**What does the calculator not cover?**
Credential hygiene, dependent service restoration (Azure AD Connect, ADFS, PKI, LDAP applications), forensics, and compliance reporting. The scope is explicitly AD forest recovery — getting domain controllers and core AD services operational. Once that's done, the rest of the recovery work begins.
