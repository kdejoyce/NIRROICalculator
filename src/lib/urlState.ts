import type { ROIInputs, EnvironmentSize, ReadinessLevel } from '../types/roi';

const DEFAULT_INPUTS: ROIInputs = {
  tier: 'tier1',
  tier1: {
    employees_total: 0,
    environment_size: 'medium',
    recovery_readiness: 'developing',
    incident_probability_per_year: 0.05,
    annual_revenue_usd: null,
    external_si_engaged: false,
    external_si_estimated_cost_usd: null,
  },
  tier2: {
    dc_count: null,
    domain_count: null,
    site_count: null,
    backup_frequency: null,
    runbook_exists: null,
    staff_experience: null,
    last_restore_test: null,
    segregated_env_available: null,
    workforce_impact_percent: null,
    fully_loaded_hourly_rate_usd: null,
    internal_ir_hourly_rate_usd: null,
    external_si_hourly_rate_usd: null,
    product_annual_cost_usd: null,
    incident_probability_per_year: null,
  },
  tco: {
    infrastructure_annual_usd: null,
    storage_annual_usd:        null,
    fte_admin_fraction:        null,
  },
};

export function getDefaultInputs(): ROIInputs {
  return structuredClone(DEFAULT_INPUTS);
}

export function inputsToParams(inputs: ROIInputs): URLSearchParams {
  const p = new URLSearchParams();
  const t = inputs.tier1;

  if (t.employees_total > 0)        p.set('emp',      String(t.employees_total));
  if (t.environment_size)           p.set('size',     t.environment_size);
if (t.recovery_readiness)         p.set('ready',    t.recovery_readiness);
  if (t.incident_probability_per_year !== 0.05) p.set('prob', String(t.incident_probability_per_year));
  if (t.annual_revenue_usd != null) p.set('rev',      String(t.annual_revenue_usd));
  if (t.external_si_engaged)        p.set('si',       '1');
  if (t.external_si_estimated_cost_usd != null) p.set('sicost', String(t.external_si_estimated_cost_usd));
  if (inputs.tier === 'tier2')      p.set('tier',     '2');

  const tc = inputs.tco;
  if (tc.infrastructure_annual_usd != null) p.set('tco_inf', String(tc.infrastructure_annual_usd));
  if (tc.storage_annual_usd        != null) p.set('tco_sto', String(tc.storage_annual_usd));
  if (tc.fte_admin_fraction        != null) p.set('tco_fte', String(tc.fte_admin_fraction));

  return p;
}

export function paramsToInputs(params: URLSearchParams): ROIInputs {
  const inputs = getDefaultInputs();
  const t = inputs.tier1;

  const emp  = params.get('emp');   if (emp)   t.employees_total = Number(emp);
  const size = params.get('size');  if (size && isEnvSize(size))   t.environment_size = size;
  const ready = params.get('ready'); if (ready && isReadiness(ready)) t.recovery_readiness = ready;
  const prob = params.get('prob');  if (prob)  t.incident_probability_per_year = Number(prob);
  const rev  = params.get('rev');   if (rev)   t.annual_revenue_usd = Number(rev);
  const si   = params.get('si');    if (si === '1') t.external_si_engaged = true;
  const sicost = params.get('sicost'); if (sicost) t.external_si_estimated_cost_usd = Number(sicost);
  const tier = params.get('tier');  if (tier === '2') inputs.tier = 'tier2';

  const tco_inf = params.get('tco_inf'); if (tco_inf) inputs.tco.infrastructure_annual_usd = Number(tco_inf);
  const tco_sto = params.get('tco_sto'); if (tco_sto) inputs.tco.storage_annual_usd        = Number(tco_sto);
  const tco_fte = params.get('tco_fte'); if (tco_fte) inputs.tco.fte_admin_fraction        = Number(tco_fte);

  return inputs;
}

function isEnvSize(v: string): v is EnvironmentSize {
  return ['small','medium','large','enterprise'].includes(v);
}
function isReadiness(v: string): v is ReadinessLevel {
  return ['limited','developing','mature'].includes(v);
}
