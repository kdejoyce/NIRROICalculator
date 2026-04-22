import type { ROIInputs, PhaseResult, RangeValue, Tier2Overrides } from '../types/roi';
import config from '../config/roiConfig.json';

type SizeKey = 'small' | 'medium' | 'large' | 'enterprise';
type ReadinessKey = 'limited' | 'developing' | 'mature';

/**
 * Derives baseline/withTool readiness multipliers from Tier 2 detail fields.
 * Returns null if no detail fields are set (fall back to Tier 1 proxy).
 * Scoring maps to the same three tiers used by the proxy selector:
 *   0–33% of available points → limited (1.4 / 1.1)
 *   34–66%                    → developing (1.0 / 0.9)
 *   67–100%                   → mature   (0.75 / 0.8)
 */
function deriveTier2ReadinessMultipliers(
  t2: Tier2Overrides,
): { baseline: number; withTool: number } | null {
  const { runbook_exists, backup_frequency, staff_experience, last_restore_test, segregated_env_available } = t2;
  const anySet = [runbook_exists, backup_frequency, staff_experience, last_restore_test, segregated_env_available].some(v => v != null);
  if (!anySet) return null;

  let score = 0;
  let max = 0;

  if (runbook_exists != null)       { max += 2; score += runbook_exists ? 2 : 0; }
  if (backup_frequency != null)     { max += 2; score += backup_frequency === 'daily' ? 2 : backup_frequency === 'weekly' ? 1 : 0; }
  if (staff_experience != null)     { max += 2; score += staff_experience === '3+' ? 2 : staff_experience === '1-2' ? 1 : 0; }
  if (last_restore_test != null)    { max += 3; score += last_restore_test === 'within_quarter' ? 3 : last_restore_test === 'within_1yr' ? 2 : last_restore_test === 'over_1yr' ? 1 : 0; }
  if (segregated_env_available != null) { max += 1; score += segregated_env_available ? 1 : 0; }

  const pct = max > 0 ? score / max : 0;
  const cfg = config.readiness_levels;
  if (pct >= 0.67) return { baseline: cfg.mature.baseline_multiplier,    withTool: cfg.mature.with_tool_multiplier };
  if (pct >= 0.34) return { baseline: cfg.developing.baseline_multiplier, withTool: cfg.developing.with_tool_multiplier };
  return { baseline: cfg.limited.baseline_multiplier, withTool: cfg.limited.with_tool_multiplier };
}

interface PhaseConfig {
  phase_id: string;
  label: string;
  description: string;
  driven_by: string;
  tool_benefit?: boolean;
  baseline_hours_by_size: Record<SizeKey, [number, number]>;
  with_tool_hours_by_size: Record<SizeKey, [number, number]>;
}

function toRange(conservative: number, aggressive: number): RangeValue {
  return {
    conservative,
    expected: (conservative + aggressive) / 2,
    aggressive,
  };
}

function applyMultiplier(range: [number, number], multiplier: number): [number, number] {
  return [range[0] * multiplier, range[1] * multiplier];
}

export function computePhases(inputs: ROIInputs): PhaseResult[] {
  const { tier1, tier2 } = inputs;

  const sizeKey = tier1.environment_size as SizeKey;
  const readinessKey = tier1.recovery_readiness as ReadinessKey;
  const readinessCfg = config.readiness_levels[readinessKey];

  // Tier 2 readiness detail overrides the proxy if any fields are set
  const tier2Readiness = inputs.tier === 'tier2' ? deriveTier2ReadinessMultipliers(tier2) : null;
  const baselineMultiplier = tier2Readiness?.baseline ?? readinessCfg.baseline_multiplier;
  const withToolMultiplier = tier2Readiness?.withTool  ?? readinessCfg.with_tool_multiplier;

  const phases = config.phases as PhaseConfig[];

  return phases.map((phase) => {
    let baselineRaw = phase.baseline_hours_by_size[sizeKey] as [number, number];
    let withToolRaw = phase.with_tool_hours_by_size[sizeKey] as [number, number];

    // Skip readiness multipliers for phases where the tool provides no benefit
    // (e.g. credential hygiene). Applying different multipliers to each side
    // would produce nonsensical negative savings for mature environments.
    if (phase.tool_benefit !== false) {
      baselineRaw = applyMultiplier(baselineRaw, baselineMultiplier);
      withToolRaw = applyMultiplier(withToolRaw, withToolMultiplier);
    }

    // Tier 2 override: if dc_count is provided, scale DC-restoration phases proportionally
    if (inputs.tier === 'tier2' && tier2.dc_count != null) {
      const dcCountMap: Record<SizeKey, number> = { small: 3, medium: 12, large: 40, enterprise: 80 };
      const baseDcCount = dcCountMap[sizeKey];
      const scaleFactor = Math.sqrt(tier2.dc_count / baseDcCount);
      if (phase.phase_id === 'restore_initial_dcs' || phase.phase_id === 'reestablish_core_ad') {
        baselineRaw = applyMultiplier(baselineRaw, scaleFactor);
        withToolRaw = applyMultiplier(withToolRaw, scaleFactor);
      }
    }

    const baseline_hours = toRange(baselineRaw[0], baselineRaw[1]);
    const with_tool_hours = toRange(withToolRaw[0], withToolRaw[1]);
    const hours_saved: RangeValue = {
      conservative: baseline_hours.conservative - with_tool_hours.conservative,
      expected:     baseline_hours.expected     - with_tool_hours.expected,
      aggressive:   baseline_hours.aggressive   - with_tool_hours.aggressive,
    };

    return {
      phase_id: phase.phase_id,
      label: phase.label,
      description: phase.description,
      baseline_hours,
      with_tool_hours,
      hours_saved,
    };
  });
}

export function sumPhases(phases: PhaseResult[], field: 'baseline_hours' | 'with_tool_hours' | 'hours_saved'): RangeValue {
  return phases.reduce(
    (acc, p) => ({
      conservative: acc.conservative + p[field].conservative,
      expected:     acc.expected     + p[field].expected,
      aggressive:   acc.aggressive   + p[field].aggressive,
    }),
    { conservative: 0, expected: 0, aggressive: 0 }
  );
}
