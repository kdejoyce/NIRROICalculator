import type { ROIInputs, RangeValue, TCOOutputs } from '../types/roi';
import config from '../config/roiConfig.json';

type SizeKey = 'small' | 'medium' | 'large' | 'enterprise';

export function computeTCO(inputs: ROIInputs, expectedAnnualValue: RangeValue): TCOOutputs {
  const { tier1, tier2, tco } = inputs;
  const d  = config.defaults;
  const td = (config as any).tco_defaults;
  const sz = tier1.environment_size as SizeKey;

  // ── License cost ─────────────────────────────────────────────────────────
  // Factored silently into total_annual_tco. Never exposed as a display line item.
  const license_annual =
    tier2.product_annual_cost_usd != null
      ? tier2.product_annual_cost_usd
      : tier1.employees_total * d.product_cost_per_user_usd;

  // ── Infrastructure ────────────────────────────────────────────────────────
  // Identity Recovery is a single VM + SQL DB application.
  // Cost reflects VM hosting; does not scale linearly with AD environment size.
  const infrastructure_annual =
    tco.infrastructure_annual_usd != null
      ? tco.infrastructure_annual_usd
      : td.infrastructure_annual_usd;

  // ── Storage ───────────────────────────────────────────────────────────────
  // AD backup data is small — 500 GB is an exceptionally high upper bound.
  const storage_annual =
    tco.storage_annual_usd != null
      ? tco.storage_annual_usd
      : td.storage_annual_by_size[sz];

  // ── FTE admin overhead ────────────────────────────────────────────────────
  const fte_admin_fraction =
    tco.fte_admin_fraction != null
      ? tco.fte_admin_fraction
      : td.fte_admin_fraction_by_size[sz];

  // Reuse internal_ir_hourly_rate if overridden in Tier2 for rate consistency
  const fte_admin_hourly_rate =
    tier2.internal_ir_hourly_rate_usd != null
      ? tier2.internal_ir_hourly_rate_usd
      : d.internal_ir_hourly_rate_usd;

  const fte_admin_annual = fte_admin_fraction * fte_admin_hourly_rate * td.fte_hours_per_year;

  // ── Annual restore test labor ─────────────────────────────────────────────
  const restore_test_hours = td.restore_test_hours_by_size[sz];
  const restore_test_annual = restore_test_hours * fte_admin_hourly_rate;

  // ── Totals ────────────────────────────────────────────────────────────────
  const non_license_annual_subtotal =
    infrastructure_annual + storage_annual + fte_admin_annual + restore_test_annual;

  const total_annual_tco = license_annual + non_license_annual_subtotal;

  // ── Full-TCO ROI and payback ──────────────────────────────────────────────
  const tco_roi_percent: RangeValue = {
    conservative: ((expectedAnnualValue.conservative - total_annual_tco) / total_annual_tco) * 100,
    expected:     ((expectedAnnualValue.expected     - total_annual_tco) / total_annual_tco) * 100,
    aggressive:   ((expectedAnnualValue.aggressive   - total_annual_tco) / total_annual_tco) * 100,
  };

  const tco_payback_months: RangeValue = {
    conservative: expectedAnnualValue.conservative > 0
      ? total_annual_tco / (expectedAnnualValue.conservative / 12) : Infinity,
    expected: expectedAnnualValue.expected > 0
      ? total_annual_tco / (expectedAnnualValue.expected / 12) : Infinity,
    aggressive: expectedAnnualValue.aggressive > 0
      ? total_annual_tco / (expectedAnnualValue.aggressive / 12) : Infinity,
  };

  return {
    infrastructure_annual,
    storage_annual,
    fte_admin_annual,
    restore_test_annual,
    non_license_annual_subtotal,
    total_annual_tco,
    tco_roi_percent,
    tco_payback_months,
    resolved: {
      fte_admin_fraction,
      fte_admin_hourly_rate,
      restore_test_hours,
    },
  };
}
