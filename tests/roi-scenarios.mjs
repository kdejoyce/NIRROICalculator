/**
 * ROI + TCO scenario test runner (20 scenarios)
 * Exercises a wide range of customer configurations and prints a full results report.
 *
 * Run with: node tests/roi-scenarios.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dir, '../src/config/roiConfig.json'), 'utf8'));

// ── Phase model ───────────────────────────────────────────────────────────────

function resolveReadinessMultipliers(tier1, tier2) {
  const fields = [tier2.backup_frequency, tier2.runbook_exists, tier2.staff_experience, tier2.last_restore_test, tier2.segregated_env_available];
  if (fields.every(f => f == null)) {
    const rl = config.readiness_levels[tier1.recovery_readiness];
    return { baseline: rl.baseline_multiplier, withTool: rl.with_tool_multiplier };
  }
  let score = 0, max = 0;
  if (tier2.runbook_exists   != null) { max += 2; score += tier2.runbook_exists ? 2 : 0; }
  if (tier2.backup_frequency != null) { max += 2; score += tier2.backup_frequency === 'daily' ? 2 : tier2.backup_frequency === 'weekly' ? 1 : 0; }
  if (tier2.staff_experience != null) { max += 2; score += tier2.staff_experience === '3+' ? 2 : tier2.staff_experience === '1-2' ? 1 : 0; }
  if (tier2.last_restore_test!= null) { max += 3; score += tier2.last_restore_test === 'within_quarter' ? 3 : tier2.last_restore_test === 'within_1yr' ? 2 : tier2.last_restore_test === 'over_1yr' ? 1 : 0; }
  if (tier2.segregated_env_available != null) { max += 1; score += tier2.segregated_env_available ? 1 : 0; }
  const pctScore = max > 0 ? score / max : 0;
  const cfg = config.readiness_levels;
  if (pctScore >= 0.67) return { baseline: cfg.mature.baseline_multiplier,    withTool: cfg.mature.with_tool_multiplier };
  if (pctScore >= 0.34) return { baseline: cfg.developing.baseline_multiplier, withTool: cfg.developing.with_tool_multiplier };
  return { baseline: cfg.limited.baseline_multiplier, withTool: cfg.limited.with_tool_multiplier };
}

function computePhases(inputs) {
  const { tier1, tier2 } = inputs;
  const sz = tier1.environment_size;
  const mults = (inputs.tier === 'tier2') ? resolveReadinessMultipliers(tier1, tier2) : (() => {
    const rl = config.readiness_levels[tier1.recovery_readiness];
    return { baseline: rl.baseline_multiplier, withTool: rl.with_tool_multiplier };
  })();
  const dcCount = (inputs.tier === 'tier2') ? tier2.dc_count : null;
  const dcMidpoints = { small: 3, medium: 12, large: 40, enterprise: 80 };

  return config.phases.map(phase => {
    let bRange = [...phase.baseline_hours_by_size[sz]];
    let tRange = [...phase.with_tool_hours_by_size[sz]];

    // Skip readiness multipliers for tool_benefit: false phases (credential hygiene fix)
    if (phase.tool_benefit !== false) {
      bRange = [bRange[0] * mults.baseline, bRange[1] * mults.baseline];
      tRange = [tRange[0] * mults.withTool,  tRange[1] * mults.withTool];
    }

    // DC count scaling for DC-restoration phases
    if (dcCount != null && (phase.phase_id === 'restore_initial_dcs' || phase.phase_id === 'reestablish_core_ad')) {
      const factor = Math.sqrt(dcCount / dcMidpoints[sz]);
      bRange = [bRange[0] * factor, bRange[1] * factor];
      tRange = [tRange[0] * factor, tRange[1] * factor];
    }

    const bExp = (bRange[0] + bRange[1]) / 2;
    const tExp = (tRange[0] + tRange[1]) / 2;
    return { phase_id: phase.phase_id, label: phase.label, tool_benefit: phase.tool_benefit, baseline: bExp, with_tool: tExp, saved: bExp - tExp };
  });
}

function sumPhases(phases, key) { return phases.reduce((s, p) => s + p[key], 0); }

// ── Dollar conversion ─────────────────────────────────────────────────────────

function computeDollars(inputs, timeSaved, laborSaved) {
  const { tier1, tier2 } = inputs;
  const d = config.defaults;
  const sz = tier1.environment_size;
  const isT2 = inputs.tier === 'tier2';

  const wip  = isT2 && tier2.workforce_impact_percent    != null ? tier2.workforce_impact_percent    : d.workforce_impact_percent;
  const flr  = isT2 && tier2.fully_loaded_hourly_rate_usd != null ? tier2.fully_loaded_hourly_rate_usd : d.fully_loaded_hourly_rate_usd;
  const iir  = isT2 && tier2.internal_ir_hourly_rate_usd  != null ? tier2.internal_ir_hourly_rate_usd  : d.internal_ir_hourly_rate_usd;
  const sir  = isT2 && tier2.external_si_hourly_rate_usd  != null ? tier2.external_si_hourly_rate_usd  : d.external_si_hourly_rate_usd;
  const pac  = isT2 && tier2.product_annual_cost_usd      != null ? tier2.product_annual_cost_usd      : tier1.employees_total * d.product_cost_per_user_usd;
  const prob = (isT2 && tier2.incident_probability_per_year != null) ? tier2.incident_probability_per_year : tier1.incident_probability_per_year;

  const impacted = tier1.employees_total * wip;
  const laborCostPerHr = impacted * flr * d.productivity_loss_factor;
  const hasRev = tier1.annual_revenue_usd > 0;
  const revPerHr = hasRev ? tier1.annual_revenue_usd / (d.working_days_per_year * d.working_hours_per_day) : 0;
  const disruptionPerHr = hasRev ? revPerHr : laborCostPerHr;

  const teamSize = d.recovery_team_size_by_size[sz];
  const disruptionAvoided = disruptionPerHr * timeSaved;
  const laborAvoided = laborSaved * iir * teamSize;

  let extAvoided = 0;
  if (tier1.external_si_engaged) {
    if (tier1.external_si_estimated_cost_usd > 0) {
      extAvoided = tier1.external_si_estimated_cost_usd * 0.35;
    } else {
      extAvoided = (d.external_si_baseline_hours_by_size[sz] - d.external_si_with_tool_hours_by_size[sz]) * sir;
    }
  }

  const totalEventValue = disruptionAvoided + laborAvoided + extAvoided;
  const annualValue = totalEventValue * prob;
  const roi = ((annualValue - pac) / pac) * 100;
  const payback = annualValue > 0 ? pac / (annualValue / 12) : Infinity;

  return { disruptionAvoided, disruptionDriver: hasRev ? 'revenue' : 'labor', laborAvoided, extAvoided, totalEventValue, annualValue, roi, payback, pac, prob };
}

// ── TCO model (aligned with tcoModel.ts — PS removed) ─────────────────────────

function computeTCO(inputs, annualValue) {
  const { tier1, tier2, tco } = inputs;
  const d  = config.defaults;
  const td = config.tco_defaults;
  const sz = tier1.environment_size;
  const isT2 = inputs.tier === 'tier2';

  const license    = isT2 && tier2.product_annual_cost_usd != null ? tier2.product_annual_cost_usd : tier1.employees_total * d.product_cost_per_user_usd;
  const infra      = tco.infrastructure_annual_usd != null ? tco.infrastructure_annual_usd : td.infrastructure_annual_usd;
  const storage    = tco.storage_annual_usd        != null ? tco.storage_annual_usd        : td.storage_annual_by_size[sz];
  const fteFrac    = tco.fte_admin_fraction        != null ? tco.fte_admin_fraction        : td.fte_admin_fraction_by_size[sz];
  const fteRate    = isT2 && tier2.internal_ir_hourly_rate_usd != null ? tier2.internal_ir_hourly_rate_usd : d.internal_ir_hourly_rate_usd;
  const fteAnnual  = fteFrac * fteRate * td.fte_hours_per_year;
  const restoreHrs = td.restore_test_hours_by_size[sz];
  const restoreAnnual = restoreHrs * fteRate;

  const nonLicense = infra + storage + fteAnnual + restoreAnnual;
  const total      = license + nonLicense;
  const tcoRoi     = ((annualValue - total) / total) * 100;
  const tcoPayback = annualValue > 0 ? total / (annualValue / 12) : Infinity;

  return { license, infra, storage, fteAnnual, restoreAnnual, nonLicense, total, tcoRoi, tcoPayback, fteFrac, fteRate, restoreHrs };
}

// ── Full calculate ────────────────────────────────────────────────────────────

function calculate(inputs) {
  const phases      = computePhases(inputs);
  const baselineHrs = sumPhases(phases, 'baseline');
  const withToolHrs = sumPhases(phases, 'with_tool');
  const savedHrs    = sumPhases(phases, 'saved');
  const savedPct    = baselineHrs > 0 ? (savedHrs / baselineHrs) * 100 : 0;
  const dollars     = computeDollars(inputs, savedHrs, savedHrs);
  const tco         = computeTCO(inputs, dollars.annualValue);
  return { phases, baselineHrs, withToolHrs, savedHrs, savedPct, dollars, tco };
}

// ── Default inputs factory ────────────────────────────────────────────────────

function defaults() {
  return {
    tier: 'tier1',
    tier1: { employees_total: 0, environment_size: 'medium', recovery_readiness: 'developing', incident_probability_per_year: 0.05, annual_revenue_usd: 0, external_si_engaged: false, external_si_estimated_cost_usd: 0 },
    tier2: { dc_count: null, domain_count: null, site_count: null, backup_frequency: null, runbook_exists: null, staff_experience: null, last_restore_test: null, segregated_env_available: null, workforce_impact_percent: null, fully_loaded_hourly_rate_usd: null, internal_ir_hourly_rate_usd: null, external_si_hourly_rate_usd: null, product_annual_cost_usd: null, incident_probability_per_year: null },
    tco: { infrastructure_annual_usd: null, storage_annual_usd: null, fte_admin_fraction: null },
  };
}

// ── Formatters ────────────────────────────────────────────────────────────────

const usd = n => isFinite(n) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : '—';
const pct = n => isFinite(n) ? `${n.toFixed(0)}%` : '—';
const hrs = h => h < 24 ? `${Math.round(h)}h` : `${(h / 8).toFixed(1)}d`;
const mo  = n => isFinite(n) ? `${n.toFixed(1)} mo` : '—';

const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const CYAN    = '\x1b[36m';
const DIM     = '\x1b[2m';
const WHITE   = '\x1b[97m';
const BG_DARK = '\x1b[48;5;236m';

function flag(value, goodThreshold, warnThreshold, format) {
  const formatted = format(value);
  if (!isFinite(value)) return `${RED}${formatted}${RESET}`;
  if (value >= goodThreshold) return `${GREEN}${formatted}${RESET}`;
  if (value >= warnThreshold) return `${YELLOW}${formatted}${RESET}`;
  return `${RED}${formatted}${RESET}`;
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const scenarios = [
  // ── TIER 1 · SMALL ──────────────────────────────────────────────────────────
  {
    name: 'S01 · Small, limited readiness, no revenue',
    desc: '500 employees · small AD · limited readiness · no revenue · 5% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 500; i.tier1.environment_size = 'small'; i.tier1.recovery_readiness = 'limited'; return i; }
  },
  {
    name: 'S02 · Small, mature readiness, low risk',
    desc: '500 employees · small AD · mature readiness · 2% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 500; i.tier1.environment_size = 'small'; i.tier1.recovery_readiness = 'mature'; i.tier1.incident_probability_per_year = 0.02; return i; }
  },
  {
    name: 'S03 · Small, elevated risk (10%), no revenue',
    desc: '750 employees · small AD · developing · 10% risk — recent gap or prior incident',
    build: () => { const i = defaults(); i.tier1.employees_total = 750; i.tier1.environment_size = 'small'; i.tier1.recovery_readiness = 'developing'; i.tier1.incident_probability_per_year = 0.10; return i; }
  },

  // ── TIER 1 · MEDIUM ─────────────────────────────────────────────────────────
  {
    name: 'S04 · Mid-market, developing, with revenue',
    desc: '3,000 employees · medium AD · developing · $250M revenue · 5% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 3000; i.tier1.environment_size = 'medium'; i.tier1.recovery_readiness = 'developing'; i.tier1.annual_revenue_usd = 250_000_000; return i; }
  },
  {
    name: 'S05 · Mid-market, limited, external SI engaged',
    desc: '5,000 employees · medium AD · limited readiness · SI at $150K estimate',
    build: () => { const i = defaults(); i.tier1.employees_total = 5000; i.tier1.environment_size = 'medium'; i.tier1.recovery_readiness = 'limited'; i.tier1.external_si_engaged = true; i.tier1.external_si_estimated_cost_usd = 150_000; return i; }
  },
  {
    name: 'S06 · Mid-market, mature, high risk (20%)',
    desc: '4,000 employees · medium AD · mature · $150M revenue · 20% risk (active threat)',
    build: () => { const i = defaults(); i.tier1.employees_total = 4000; i.tier1.environment_size = 'medium'; i.tier1.recovery_readiness = 'mature'; i.tier1.annual_revenue_usd = 150_000_000; i.tier1.incident_probability_per_year = 0.20; return i; }
  },

  // ── TIER 1 · LARGE ──────────────────────────────────────────────────────────
  {
    name: 'S07 · Large, developing, $1B revenue',
    desc: '15,000 employees · large AD · developing · $1B revenue · 5% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 15000; i.tier1.environment_size = 'large'; i.tier1.recovery_readiness = 'developing'; i.tier1.annual_revenue_usd = 1_000_000_000; return i; }
  },
  {
    name: 'S08 · Large, mature, no revenue',
    desc: '12,000 employees · large AD · mature readiness · labor driver · 5% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 12000; i.tier1.environment_size = 'large'; i.tier1.recovery_readiness = 'mature'; return i; }
  },
  {
    name: 'S09 · Large, limited, external SI (no estimate)',
    desc: '20,000 employees · large AD · limited readiness · SI engaged (uses default hours)',
    build: () => { const i = defaults(); i.tier1.employees_total = 20000; i.tier1.environment_size = 'large'; i.tier1.recovery_readiness = 'limited'; i.tier1.external_si_engaged = true; return i; }
  },

  // ── TIER 1 · ENTERPRISE ─────────────────────────────────────────────────────
  {
    name: 'S10 · Enterprise, limited, labor driver',
    desc: '50,000 employees · enterprise AD · limited readiness · no revenue · 5% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 50000; i.tier1.environment_size = 'enterprise'; i.tier1.recovery_readiness = 'limited'; return i; }
  },
  {
    name: 'S11 · Enterprise, developing, $5B revenue',
    desc: '80,000 employees · enterprise AD · developing · $5B revenue · 5% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 80000; i.tier1.environment_size = 'enterprise'; i.tier1.recovery_readiness = 'developing'; i.tier1.annual_revenue_usd = 5_000_000_000; return i; }
  },
  {
    name: 'S12 · Enterprise, mature, $2B revenue',
    desc: '60,000 employees · enterprise AD · mature · $2B revenue · 5% risk',
    build: () => { const i = defaults(); i.tier1.employees_total = 60000; i.tier1.environment_size = 'enterprise'; i.tier1.recovery_readiness = 'mature'; i.tier1.annual_revenue_usd = 2_000_000_000; return i; }
  },

  // ── TIER 2 · DETAILED INPUTS ─────────────────────────────────────────────────
  {
    name: 'S13 · T2 · Enterprise, 80 DCs, elevated prob',
    desc: '25,000 employees · enterprise · 80 DCs · elevated risk 10% · $2B revenue',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 25000; i.tier1.environment_size = 'enterprise'; i.tier1.recovery_readiness = 'developing'; i.tier1.annual_revenue_usd = 2_000_000_000; i.tier1.incident_probability_per_year = 0.10;
      i.tier2.dc_count = 80; i.tier2.incident_probability_per_year = 0.10;
      return i;
    }
  },
  {
    name: 'S14 · T2 · Large, mature detail, custom rate',
    desc: '8,000 employees · large AD · $150/hr IT rate · daily backups · runbook · 3+ staff · recent test',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 8000; i.tier1.environment_size = 'large'; i.tier1.recovery_readiness = 'developing'; i.tier1.annual_revenue_usd = 500_000_000;
      i.tier2.internal_ir_hourly_rate_usd = 150; i.tier2.runbook_exists = true; i.tier2.backup_frequency = 'daily'; i.tier2.last_restore_test = 'within_1yr'; i.tier2.staff_experience = '3+'; i.tier2.segregated_env_available = true;
      return i;
    }
  },
  {
    name: 'S15 · T2 · Medium, poor detail readiness',
    desc: '5,000 employees · medium AD · no runbook · backups infrequent · no staff exp · never tested',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 5000; i.tier1.environment_size = 'medium'; i.tier1.recovery_readiness = 'developing';
      i.tier2.runbook_exists = false; i.tier2.backup_frequency = 'other'; i.tier2.staff_experience = 'none'; i.tier2.last_restore_test = 'never'; i.tier2.segregated_env_available = false;
      return i;
    }
  },
  {
    name: 'S16 · T2 · Small, SMB, 2% risk, custom FTE override',
    desc: '300 employees · small AD · mature · 2% risk · custom FTE overhead 3%',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 300; i.tier1.environment_size = 'small'; i.tier1.recovery_readiness = 'mature'; i.tier1.incident_probability_per_year = 0.02;
      i.tier2.incident_probability_per_year = 0.02;
      i.tco.fte_admin_fraction = 0.03;
      return i;
    }
  },
  {
    name: 'S17 · T2 · Enterprise, high risk, custom rates',
    desc: '100,000 employees · enterprise · 20% risk · $200/hr IT rate · $10B revenue',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 100000; i.tier1.environment_size = 'enterprise'; i.tier1.recovery_readiness = 'limited'; i.tier1.annual_revenue_usd = 10_000_000_000; i.tier1.incident_probability_per_year = 0.20;
      i.tier2.internal_ir_hourly_rate_usd = 200; i.tier2.incident_probability_per_year = 0.20;
      return i;
    }
  },
  {
    name: 'S18 · T2 · Medium, custom product cost',
    desc: '10,000 employees · medium AD · developing · custom product cost $80K/yr',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 10000; i.tier1.environment_size = 'medium'; i.tier1.recovery_readiness = 'developing'; i.tier1.annual_revenue_usd = 400_000_000;
      i.tier2.product_annual_cost_usd = 80_000;
      return i;
    }
  },
  {
    name: 'S19 · T2 · Large, custom infra + storage overrides',
    desc: '18,000 employees · large AD · developing · custom infra $3K/yr + storage $500/yr',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 18000; i.tier1.environment_size = 'large'; i.tier1.recovery_readiness = 'developing'; i.tier1.annual_revenue_usd = 800_000_000;
      i.tco.infrastructure_annual_usd = 3000;
      i.tco.storage_annual_usd = 500;
      return i;
    }
  },
  {
    name: 'S20 · T2 · Worst case — tiny org, no revenue, low risk',
    desc: '100 employees · small AD · limited · 2% risk · labor only — minimum viable deal',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 100; i.tier1.environment_size = 'small'; i.tier1.recovery_readiness = 'limited'; i.tier1.incident_probability_per_year = 0.02;
      i.tier2.incident_probability_per_year = 0.02;
      return i;
    }
  },

  // ── NEW SCENARIOS ──────────────────────────────────────────────────────────
  {
    name: 'S21 · Small, revenue driver, elevated risk',
    desc: '400 employees · small AD · developing · $50M revenue · 10% risk — revenue unlocks the story',
    build: () => {
      const i = defaults();
      i.tier1.employees_total = 400; i.tier1.environment_size = 'small'; i.tier1.recovery_readiness = 'developing';
      i.tier1.annual_revenue_usd = 50_000_000; i.tier1.incident_probability_per_year = 0.10;
      return i;
    }
  },
  {
    name: 'S22 · Medium, SI default hours (no estimate)',
    desc: '6,000 employees · medium AD · limited · SI engaged, no cost estimate — uses default hour tables',
    build: () => {
      const i = defaults();
      i.tier1.employees_total = 6000; i.tier1.environment_size = 'medium'; i.tier1.recovery_readiness = 'limited';
      i.tier1.external_si_engaged = true;
      return i;
    }
  },
  {
    name: 'S23 · Enterprise, mature, low risk (2%)',
    desc: '40,000 employees · enterprise AD · mature · $1B revenue · 2% risk — downside enterprise case',
    build: () => {
      const i = defaults();
      i.tier1.employees_total = 40000; i.tier1.environment_size = 'enterprise'; i.tier1.recovery_readiness = 'mature';
      i.tier1.annual_revenue_usd = 1_000_000_000; i.tier1.incident_probability_per_year = 0.02;
      return i;
    }
  },
  {
    name: 'S24 · T2 · Large, custom product cost + high risk',
    desc: '10,000 employees · large AD · limited · $600M revenue · 20% risk · custom product $100K',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 10000; i.tier1.environment_size = 'large'; i.tier1.recovery_readiness = 'limited';
      i.tier1.annual_revenue_usd = 600_000_000; i.tier1.incident_probability_per_year = 0.20;
      i.tier2.product_annual_cost_usd = 100_000; i.tier2.incident_probability_per_year = 0.20;
      return i;
    }
  },
  {
    name: 'S25 · T2 · Medium, SI engaged + mature detail readiness',
    desc: '7,000 employees · medium AD · mature detail · $200M revenue · SI $200K estimate · 5% risk',
    build: () => {
      const i = defaults(); i.tier = 'tier2';
      i.tier1.employees_total = 7000; i.tier1.environment_size = 'medium'; i.tier1.recovery_readiness = 'developing';
      i.tier1.annual_revenue_usd = 200_000_000; i.tier1.external_si_engaged = true; i.tier1.external_si_estimated_cost_usd = 200_000;
      i.tier2.runbook_exists = true; i.tier2.backup_frequency = 'daily'; i.tier2.last_restore_test = 'within_quarter'; i.tier2.staff_experience = '3+'; i.tier2.segregated_env_available = true;
      return i;
    }
  },
];

// ── Report ────────────────────────────────────────────────────────────────────

const divider  = `${DIM}${'─'.repeat(90)}${RESET}`;
const dividerH = `${DIM}${'═'.repeat(90)}${RESET}`;

console.log('\n');
console.log(`${BG_DARK}${WHITE}${BOLD}  NETWRIX IDENTITY RECOVERY — ROI + TCO SCENARIO REPORT (25 SCENARIOS)  ${RESET}`);
console.log(`${DIM}  Config v${config.meta.config_version} · Calibrated ${config.meta.last_calibrated_date}  ·  PS removed from TCO · Credential hygiene multiplier fix applied${RESET}`);
console.log('\n');

const summary = [];
let credHygieneIssues = 0;

for (const scenario of scenarios) {
  const inputs  = scenario.build();
  const r       = calculate(inputs);
  const { dollars: d, tco } = r;

  console.log(dividerH);
  console.log(`${BOLD}${CYAN}${scenario.name}${RESET}`);
  console.log(`${DIM}${scenario.desc}${RESET}`);
  console.log(divider);

  // ── Config ──────────────────────────────────────────────────────────────
  const t1 = inputs.tier1;
  const t2 = inputs.tier2;
  console.log(`${BOLD}  CONFIG${RESET}`);
  console.log(`  Tier:              ${inputs.tier}`);
  console.log(`  Employees:         ${t1.employees_total.toLocaleString()}`);
  console.log(`  Size:              ${t1.environment_size}`);
  console.log(`  Readiness:         ${t1.recovery_readiness}`);
  console.log(`  Risk:              ${pct(t1.incident_probability_per_year * 100)} annual`);
  console.log(`  Revenue:           ${t1.annual_revenue_usd > 0 ? usd(t1.annual_revenue_usd) : 'not provided (labor driver)'}`);
  console.log(`  External SI:       ${t1.external_si_engaged ? `Yes${t1.external_si_estimated_cost_usd > 0 ? ` (${usd(t1.external_si_estimated_cost_usd)} est.)` : ' (no estimate — default hours)'}` : 'No'}`);
  if (inputs.tier === 'tier2') {
    if (t2.dc_count)                         console.log(`  DC Count:          ${t2.dc_count}`);
    if (t2.runbook_exists     != null)       console.log(`  Runbook:           ${t2.runbook_exists ? 'Yes' : 'No'}`);
    if (t2.backup_frequency)                 console.log(`  Backup Freq:       ${t2.backup_frequency}`);
    if (t2.last_restore_test)                console.log(`  Last Test:         ${t2.last_restore_test}`);
    if (t2.staff_experience)                 console.log(`  Staff Exp:         ${t2.staff_experience}`);
    if (t2.segregated_env_available != null) console.log(`  Segregated Env:    ${t2.segregated_env_available ? 'Yes' : 'No'}`);
    if (t2.internal_ir_hourly_rate_usd)      console.log(`  IT/IR Rate:        $${t2.internal_ir_hourly_rate_usd}/hr`);
    if (t2.product_annual_cost_usd)          console.log(`  Product Cost:      ${usd(t2.product_annual_cost_usd)} (override)`);
    if (t2.incident_probability_per_year)    console.log(`  Prob Override:     ${pct(t2.incident_probability_per_year * 100)}`);
  }
  if (inputs.tco.fte_admin_fraction       != null) console.log(`  TCO FTE Override:  ${pct(inputs.tco.fte_admin_fraction * 100)}`);
  if (inputs.tco.infrastructure_annual_usd != null) console.log(`  TCO Infra Override:${usd(inputs.tco.infrastructure_annual_usd)}`);
  if (inputs.tco.storage_annual_usd       != null) console.log(`  TCO Storage Over.: ${usd(inputs.tco.storage_annual_usd)}`);

  // ── Time + Phase Breakdown ────────────────────────────────────────────────
  console.log(`\n${BOLD}  TIME & PHASE BREAKDOWN${RESET}`);
  console.log(`  Baseline: ${hrs(r.baselineHrs)}  →  With tool: ${hrs(r.withToolHrs)}  →  ${GREEN}Saved: ${hrs(r.savedHrs)} (${pct(r.savedPct)})${RESET}`);
  for (const p of r.phases) {
    const savedPct = p.baseline > 0 ? ((p.saved / p.baseline) * 100).toFixed(0) : '0';
    const noTool = p.tool_benefit === false;
    const savedColor = p.saved < 0 ? RED : p.saved === 0 ? DIM : GREEN;
    const tag = noTool ? `${DIM} [no tool benefit]${RESET}` : '';
    // Flag credential hygiene negative savings as a PASS/FAIL check
    if (p.saved < 0) credHygieneIssues++;
    console.log(`  ${p.label.padEnd(42)} base ${hrs(p.baseline).padStart(6)}  tool ${hrs(p.with_tool).padStart(6)}  ${savedColor}saved ${pct(Number(savedPct)).padStart(5)}${RESET}${tag}`);
  }

  // ── Value ────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}  FINANCIAL VALUE (expected)${RESET}`);
  console.log(`  Driver:                  ${d.disruptionDriver.toUpperCase()}`);
  const driverLabel = d.disruptionDriver === 'revenue' ? 'Revenue at risk avoided' : 'Workforce productivity avoided';
  console.log(`  ${driverLabel.padEnd(30)} ${usd(d.disruptionAvoided)}`);
  console.log(`  Recovery team labor avoided  ${usd(d.laborAvoided)}`);
  if (d.extAvoided > 0) console.log(`  External SI avoided          ${usd(d.extAvoided)}`);
  console.log(`  Total if incident occurs     ${BOLD}${usd(d.totalEventValue)}${RESET}`);
  console.log(`  Expected annual value (${pct(d.prob * 100)}) ${GREEN}${BOLD}${usd(d.annualValue)}${RESET}`);

  // ── ROI ───────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}  LICENSE-ONLY ROI${RESET}`);
  console.log(`  Product cost:   ${usd(d.pac)}  ROI: ${flag(d.roi, 100, 0, pct)}  Payback: ${flag(-d.payback, -24, -Infinity, () => mo(d.payback))}`);

  // ── TCO ───────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}  TCO (PS removed)${RESET}`);
  console.log(`  Infrastructure:     ${usd(tco.infra)}`);
  console.log(`  Storage:            ${usd(tco.storage)}`);
  console.log(`  Admin FTE:          ${usd(tco.fteAnnual)}  ${DIM}(${pct(tco.fteFrac * 100)} FTE @ $${tco.fteRate}/hr)${RESET}`);
  console.log(`  Restore testing:    ${usd(tco.restoreAnnual)}  ${DIM}(${tco.restoreHrs}h @ $${tco.fteRate}/hr)${RESET}`);
  console.log(`  Software inv.:      ${DIM}included in total, not shown${RESET}`);
  console.log(`  ──────────────────────────`);
  console.log(`  Total annual TCO:   ${BOLD}${usd(tco.total)}${RESET}`);
  console.log(`  Full-TCO ROI:       ${flag(tco.tcoRoi, 100, 0, pct)}`);
  console.log(`  Full-TCO Payback:   ${flag(-tco.tcoPayback, -24, -Infinity, () => mo(tco.tcoPayback))}`);

  summary.push({
    name: scenario.name,
    size: t1.environment_size,
    readiness: t1.recovery_readiness,
    timeSaved: r.savedPct,
    annualValue: d.annualValue,
    licenseRoi: d.roi,
    tcoRoi: tco.tcoRoi,
    tcoPayback: tco.tcoPayback,
    totalTco: tco.total,
    license: tco.license,
  });

  console.log('\n');
}

// ── Summary table ─────────────────────────────────────────────────────────────

console.log(dividerH);
console.log(`${BOLD}${WHITE}  SUMMARY TABLE — ALL 25 SCENARIOS${RESET}`);
console.log(divider);
const hdr = `  ${'#'.padEnd(5)} ${'Size'.padEnd(11)} ${'Ready'.padEnd(11)} ${'Saved%'.padStart(7)} ${'Ann. Value'.padStart(13)} ${'License'.padStart(11)} ${'Total TCO'.padStart(11)} ${'Lic ROI'.padStart(9)} ${'TCO ROI'.padStart(9)} ${'Payback'.padStart(9)}`;
console.log(hdr);
console.log(divider);

for (const s of summary) {
  const num       = s.name.split(' · ')[0].trim();
  const roiColor  = s.licenseRoi >= 100 ? GREEN : s.licenseRoi >= 0 ? YELLOW : RED;
  const tcoColor  = s.tcoRoi    >= 100 ? GREEN : s.tcoRoi    >= 0 ? YELLOW : RED;
  const pbColor   = s.tcoPayback <= 12  ? GREEN : s.tcoPayback <= 24 ? YELLOW : RED;
  console.log(
    `  ${num.padEnd(5)} ${s.size.padEnd(11)} ${s.readiness.padEnd(11)} ` +
    `${GREEN}${pct(s.timeSaved).padStart(7)}${RESET} ` +
    `${usd(s.annualValue).padStart(13)} ` +
    `${usd(s.license).padStart(11)} ` +
    `${usd(s.totalTco).padStart(11)} ` +
    `${roiColor}${pct(s.licenseRoi).padStart(9)}${RESET} ` +
    `${tcoColor}${pct(s.tcoRoi).padStart(9)}${RESET} ` +
    `${pbColor}${mo(s.tcoPayback).padStart(9)}${RESET}`
  );
}

console.log('\n');

// ── Validation checks ─────────────────────────────────────────────────────────
console.log(`${BOLD}  VALIDATION CHECKS${RESET}`);
const credHygieneCheck = credHygieneIssues === 0 ? `${GREEN}PASS${RESET}` : `${RED}FAIL (${credHygieneIssues} negative savings)${RESET}`;
console.log(`  Credential hygiene negative savings:  ${credHygieneCheck}`);

const allTimeSaved = summary.every(s => s.timeSaved > 0);
console.log(`  All scenarios show positive time saved: ${allTimeSaved ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);

const noNegativeTco = summary.every(s => s.totalTco > 0);
console.log(`  All TCO totals positive:                ${noNegativeTco ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);

const smallTco = summary.find(s => s.size === 'small' && s.readiness === 'limited');
const entTco   = summary.find(s => s.size === 'enterprise' && s.readiness === 'limited');
if (smallTco && entTco) {
  const tcoScales = entTco.totalTco > smallTco.totalTco;
  console.log(`  Enterprise TCO > Small TCO:             ${tcoScales ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`} (${usd(smallTco.totalTco)} → ${usd(entTco.totalTco)})`);
}

console.log('\n');
console.log(`${DIM}  🟢 ROI ≥100% or payback ≤12mo   🟡 ROI 0–99% or payback 13–24mo   🔴 negative or >24mo${RESET}`);
console.log('\n');
