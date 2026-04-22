import type { ROIInputs, ROIOutputs, RangeValue, TimeOutputs } from '../types/roi';
import { computePhases, sumPhases } from './phaseModel';
import { computeDollars } from './dollarConversion';
import { computeTCO } from './tcoModel';
import config from '../config/roiConfig.json';

function todays(hours: RangeValue): RangeValue {
  const hpd = config.defaults.working_hours_per_day;
  return {
    conservative: hours.conservative / hpd,
    expected:     hours.expected     / hpd,
    aggressive:   hours.aggressive   / hpd,
  };
}

function percentSaved(saved: RangeValue, baseline: RangeValue): RangeValue {
  const safe = (s: number, b: number) => (b > 0 ? (s / b) * 100 : 0);
  return {
    conservative: safe(saved.conservative, baseline.conservative),
    expected:     safe(saved.expected,     baseline.expected),
    aggressive:   safe(saved.aggressive,   baseline.aggressive),
  };
}

function isComplete(inputs: ROIInputs): boolean {
  const { tier1 } = inputs;
  return (
    tier1.employees_total > 0 &&
    !!tier1.environment_size &&
    !!tier1.recovery_readiness
  );
}

export function calculate(inputs: ROIInputs): ROIOutputs {
  if (!isComplete(inputs)) {
    return {
      time: {
        baseline_elapsed_hours:  { conservative: 0, expected: 0, aggressive: 0 },
        with_tool_elapsed_hours: { conservative: 0, expected: 0, aggressive: 0 },
        time_saved_hours:        { conservative: 0, expected: 0, aggressive: 0 },
        time_saved_percent:      { conservative: 0, expected: 0, aggressive: 0 },
        baseline_elapsed_days:   { conservative: 0, expected: 0, aggressive: 0 },
        with_tool_elapsed_days:  { conservative: 0, expected: 0, aggressive: 0 },
        phases: [],
      },
      dollars: {
        business_disruption_avoided: { conservative: 0, expected: 0, aggressive: 0 },
        disruption_driver:           'labor' as const,
        recovery_team_labor_avoided: { conservative: 0, expected: 0, aggressive: 0 },
        external_services_avoided:   { conservative: 0, expected: 0, aggressive: 0 },
        total_event_value:           { conservative: 0, expected: 0, aggressive: 0 },
        incident_probability:        0,
        expected_annual_value:       { conservative: 0, expected: 0, aggressive: 0 },
        roi_percent:                 { conservative: 0, expected: 0, aggressive: 0 },
        payback_period_months:       { conservative: 0, expected: 0, aggressive: 0 },
      },
      assumptions: {
        workforce_impact_percent: 0,
        productivity_loss_factor: 0,
        incident_probability_per_year: 0,
        fully_loaded_hourly_rate_usd: 0,
        internal_ir_hourly_rate_usd: 0,
        external_si_hourly_rate_usd: 0,
        product_annual_cost_usd: 0,
        config_version: config.meta.config_version,
        last_calibrated_date: config.meta.last_calibrated_date,
      },
      is_complete: false,
    };
  }

  const phases = computePhases(inputs);

  const baseline_elapsed_hours  = sumPhases(phases, 'baseline_hours');
  const with_tool_elapsed_hours = sumPhases(phases, 'with_tool_hours');
  const time_saved_hours        = sumPhases(phases, 'hours_saved');
  const time_saved_percent      = percentSaved(time_saved_hours, baseline_elapsed_hours);

  // Labor hours saved = phase hours saved (recovery team hours track with elapsed time at ~1:1 for first responders)
  const laborHoursSaved = time_saved_hours;

  const time: TimeOutputs = {
    baseline_elapsed_hours,
    with_tool_elapsed_hours,
    time_saved_hours,
    time_saved_percent,
    baseline_elapsed_days:  todays(baseline_elapsed_hours),
    with_tool_elapsed_days: todays(with_tool_elapsed_hours),
    phases,
  };

  const { dollars, assumptions } = computeDollars(inputs, time_saved_hours, laborHoursSaved);
  const tco = computeTCO(inputs, dollars.expected_annual_value);

  return { time, dollars, assumptions, tco, is_complete: true };
}
