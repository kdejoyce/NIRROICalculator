// ─── Enum-like string unions ─────────────────────────────────────────────────

export type EnvironmentSize = 'small' | 'medium' | 'large' | 'enterprise';
export type ReadinessLevel  = 'limited' | 'developing' | 'mature';
export type CalculatorTier = 'tier1' | 'tier2';

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface Tier1Inputs {
  // Workforce
  employees_total: number;
  // Proxies
  environment_size: EnvironmentSize;
  recovery_readiness: ReadinessLevel;
  // Incident probability (annual)
  incident_probability_per_year: number;
  // Revenue (optional)
  annual_revenue_usd: number | null;
  // External SI
  external_si_engaged: boolean;
  external_si_estimated_cost_usd: number | null;
}

export interface Tier2Overrides {
  // Environment detail overrides (replace size proxy)
  dc_count: number | null;
  domain_count: number | null;
  site_count: number | null;
  // Readiness detail overrides
  backup_frequency: 'daily' | 'weekly' | 'other' | null;
  runbook_exists: boolean | null;
  staff_experience: 'none' | '1-2' | '3+' | null;
  last_restore_test: 'never' | 'over_1yr' | 'within_1yr' | 'within_quarter' | null;
  segregated_env_available: boolean | null;
  // Cost overrides
  workforce_impact_percent: number | null;       // 0–1
  fully_loaded_hourly_rate_usd: number | null;
  internal_ir_hourly_rate_usd: number | null;
  external_si_hourly_rate_usd: number | null;
  product_annual_cost_usd: number | null;
  // Risk override
  incident_probability_per_year: number | null;  // 0–1
}

export interface TCOInputs {
  infrastructure_annual_usd:  number | null;   // $/yr hosting cost
  storage_annual_usd:         number | null;   // $/yr backup storage
  fte_admin_fraction:         number | null;   // 0.0–1.0 fraction of one FTE
}

export interface ROIInputs {
  tier: CalculatorTier;
  tier1: Tier1Inputs;
  tier2: Tier2Overrides;
  tco: TCOInputs;
}

// ─── Phase results ────────────────────────────────────────────────────────────

export interface PhaseResult {
  phase_id: string;
  label: string;
  description: string;
  baseline_hours: RangeValue;
  with_tool_hours: RangeValue;
  hours_saved: RangeValue;
}

// ─── Range value ─────────────────────────────────────────────────────────────

export interface RangeValue {
  conservative: number;
  expected: number;
  aggressive: number;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export interface TimeOutputs {
  baseline_elapsed_hours: RangeValue;
  with_tool_elapsed_hours: RangeValue;
  time_saved_hours: RangeValue;
  time_saved_percent: RangeValue;
  baseline_elapsed_days: RangeValue;
  with_tool_elapsed_days: RangeValue;
  phases: PhaseResult[];
}

export interface DollarOutputs {
  // Per-incident costs (if the event actually occurs)
  business_disruption_avoided: RangeValue;
  disruption_driver: 'revenue' | 'labor';
  recovery_team_labor_avoided: RangeValue;
  external_services_avoided: RangeValue;
  total_event_value: RangeValue;             // total savings if incident occurs
  // Probability-adjusted annual value (primary metric)
  incident_probability: number;              // e.g. 0.05
  expected_annual_value: RangeValue;         // total_event_value × probability
  // ROI based on expected_annual_value
  roi_percent: RangeValue;
  payback_period_months: RangeValue;
}

export interface TCOOutputs {
  // Annual recurring components (non-license — shown in UI)
  infrastructure_annual:        number;
  storage_annual:               number;
  fte_admin_annual:             number;
  restore_test_annual:          number;
  non_license_annual_subtotal:  number;
  // Total annual TCO — includes license cost (never shown as a line item)
  total_annual_tco:             number;
  // Full-TCO ROI metrics
  tco_roi_percent:              RangeValue;
  tco_payback_months:           RangeValue;
  // Resolved assumptions (for display notes and export)
  resolved: {
    fte_admin_fraction:         number;
    fte_admin_hourly_rate:      number;
    restore_test_hours:         number;
  };
}

export interface ROIOutputs {
  time: TimeOutputs;
  dollars: DollarOutputs;
  assumptions: AssumptionSnapshot;
  tco?: TCOOutputs;
  is_complete: boolean;
}

// ─── Assumption snapshot (surfaced in export) ─────────────────────────────────

export interface AssumptionSnapshot {
  workforce_impact_percent: number;
  productivity_loss_factor: number;
  incident_probability_per_year: number;
  fully_loaded_hourly_rate_usd: number;
  internal_ir_hourly_rate_usd: number;
  external_si_hourly_rate_usd: number;
  product_annual_cost_usd: number;
  config_version: string;
  last_calibrated_date: string;
}
