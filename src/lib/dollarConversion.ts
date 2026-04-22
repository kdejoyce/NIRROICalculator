import type { ROIInputs, RangeValue, DollarOutputs, AssumptionSnapshot } from '../types/roi';
import config from '../config/roiConfig.json';

type SizeKey = 'small' | 'medium' | 'large' | 'enterprise';

function scalar(n: number): RangeValue {
  return { conservative: n, expected: n, aggressive: n };
}

export function computeDollars(
  inputs: ROIInputs,
  timeSavedHours: RangeValue,
  laborHoursSaved: RangeValue,
): { dollars: DollarOutputs; assumptions: AssumptionSnapshot } {
  const { tier, tier1, tier2 } = inputs;
  const d = config.defaults;
  const sizeKey = tier1.environment_size as SizeKey;
  const isT2 = tier === 'tier2';

  // Resolved assumptions (tier2 overrides where provided)
  const workforce_impact_percent =
    isT2 && tier2.workforce_impact_percent != null
      ? tier2.workforce_impact_percent
      : d.workforce_impact_percent;

  const fully_loaded_hourly_rate_usd =
    isT2 && tier2.fully_loaded_hourly_rate_usd != null
      ? tier2.fully_loaded_hourly_rate_usd
      : d.fully_loaded_hourly_rate_usd;

  const internal_ir_hourly_rate_usd =
    isT2 && tier2.internal_ir_hourly_rate_usd != null
      ? tier2.internal_ir_hourly_rate_usd
      : d.internal_ir_hourly_rate_usd;

  const external_si_hourly_rate_usd =
    isT2 && tier2.external_si_hourly_rate_usd != null
      ? tier2.external_si_hourly_rate_usd
      : d.external_si_hourly_rate_usd;

  const product_annual_cost_usd =
    isT2 && tier2.product_annual_cost_usd != null
      ? tier2.product_annual_cost_usd
      : tier1.employees_total * d.product_cost_per_user_usd;

  // ── Business disruption avoided ──────────────────────────────────────────
  // Primary driver: revenue/hr when revenue is provided; workforce labor otherwise.
  // These answer the same question from two lenses — use one, not both.
  const impacted_employees = tier1.employees_total * workforce_impact_percent;
  // productivity_loss_factor: impacted employees aren't 100% non-productive —
  // cached creds, mobile, offline work, and workarounds reduce actual loss.
  const productivity_loss_factor = d.productivity_loss_factor ?? 0.30;
  const labor_cost_per_hour = impacted_employees * fully_loaded_hourly_rate_usd * productivity_loss_factor;

  const hasRevenue = tier1.annual_revenue_usd != null && tier1.annual_revenue_usd > 0;
  const revenue_per_hour = hasRevenue
    ? tier1.annual_revenue_usd! / (d.working_days_per_year * d.working_hours_per_day)
    : 0;

  const disruption_driver: 'revenue' | 'labor' = hasRevenue ? 'revenue' : 'labor';
  const disruption_cost_per_hour = hasRevenue ? revenue_per_hour : labor_cost_per_hour;

  const business_disruption_avoided = scalar(disruption_cost_per_hour * timeSavedHours.expected);

  // ── Recovery team labor avoided ──────────────────────────────────────────
  // Cost of AD/IR specialist team time only — separate from business disruption.
  // Team size scales with environment: a forest recovery is a team effort, not a single-person task.
  const recovery_team_size = (d as any).recovery_team_size_by_size?.[sizeKey] ?? 2;
  const recovery_team_labor_avoided = scalar(laborHoursSaved.expected * internal_ir_hourly_rate_usd * recovery_team_size);

  // ── External services avoided ────────────────────────────────────────────
  let ext_avoided = 0;
  if (tier1.external_si_engaged) {
    if (tier1.external_si_estimated_cost_usd != null) {
      // Applies 35% savings factor — Identity Recovery eliminates the AD forest recovery
      // portion of a full IR engagement (~30–40% of scope). Credential hygiene, dependent
      // service restoration, forensics, and reporting remain outside the tool's scope.
      ext_avoided = tier1.external_si_estimated_cost_usd * 0.35;
    } else {
      // Use default hours from config
      const savedHrs = d.external_si_baseline_hours_by_size[sizeKey] - d.external_si_with_tool_hours_by_size[sizeKey];
      ext_avoided = savedHrs * external_si_hourly_rate_usd;
    }
  }
  const external_services_avoided = scalar(ext_avoided);

  // ── Totals ────────────────────────────────────────────────────────────────
  const total_event_value = scalar(
    business_disruption_avoided.expected +
    recovery_team_labor_avoided.expected +
    external_services_avoided.expected
  );

  // ── Probability-adjusted annual value ────────────────────────────────────
  // An AD forest recovery event is rare. ROI against the annual software cost
  // must account for the likelihood of the event, not just the cost if it occurs.
  const incident_probability =
    isT2 && tier2.incident_probability_per_year != null
      ? tier2.incident_probability_per_year
      : tier1.incident_probability_per_year ?? d.incident_probability_default ?? 0.05;
  const annual_value = total_event_value.expected * incident_probability;
  const expected_annual_value = scalar(annual_value);

  const roi_percent = scalar(
    ((annual_value - product_annual_cost_usd) / product_annual_cost_usd) * 100
  );

  const payback_period_months = scalar(
    annual_value > 0 ? product_annual_cost_usd / (annual_value / 12) : Infinity
  );

  const assumptions: AssumptionSnapshot = {
    workforce_impact_percent,
    productivity_loss_factor,
    incident_probability_per_year: incident_probability,
    fully_loaded_hourly_rate_usd,
    internal_ir_hourly_rate_usd,
    external_si_hourly_rate_usd,
    product_annual_cost_usd,
    config_version: config.meta.config_version,
    last_calibrated_date: config.meta.last_calibrated_date,
  };

  return {
    dollars: {
      business_disruption_avoided,
      disruption_driver,
      recovery_team_labor_avoided,
      external_services_avoided,
      total_event_value,
      incident_probability,
      expected_annual_value,
      roi_percent,
      payback_period_months,
    },
    assumptions,
  };
}
