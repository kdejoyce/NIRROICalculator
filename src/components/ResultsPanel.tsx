import React from 'react';
import type { ROIOutputs, RangeValue } from '../types/roi';

interface Props {
  outputs: ROIOutputs;
}

function fmt(n: number, style: 'currency' | 'decimal' | 'percent' = 'decimal', decimals = 0): string {
  if (!isFinite(n)) return '—';
  if (style === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  }
  if (style === 'percent') return `${n.toFixed(decimals)}%`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n);
}

function fmtHours(h: number): string {
  if (h < 24) return `${Math.round(h)}h`;
  const days = h / 24;
  return `${days.toFixed(1)}d`;
}

function ValueRow({
  label,
  value,
  format = 'currency',
  highlight = false,
}: {
  label: string;
  value: RangeValue;
  format?: 'currency' | 'percent' | 'hours' | 'months';
  highlight?: boolean;
}) {
  const f = (n: number) => {
    if (format === 'currency') return fmt(n, 'currency');
    if (format === 'percent') return fmt(n, 'percent', 0);
    if (format === 'hours') return fmtHours(n);
    if (format === 'months') return isFinite(n) ? `${n.toFixed(1)} mo` : '—';
    return fmt(n);
  };

  return (
    <tr className={highlight ? 'border-t border-access-white/10' : ''}>
      <td className={`py-3 pr-4 text-f-f font-syne ${highlight ? 'font-semibold text-access-white' : 'text-access-white/70'}`}>
        {label}
      </td>
      <td className={`py-3 text-f-f text-right font-syne tabular-nums ${highlight ? 'font-bold text-beacon-green' : 'text-beacon-green/80'}`}>
        {f(value.expected)}
      </td>
    </tr>
  );
}

function SimpleTCORow({ label, value, note, bold = false }: { label: string; value: number; note?: string; bold?: boolean }) {
  return (
    <tr>
      <td className={`py-2 pr-4 text-f-f font-syne ${bold ? 'font-semibold text-access-white' : 'text-access-white/70'}`}>
        {label}
        {note && <span className="text-f-g text-access-white/40 ml-2">{note}</span>}
      </td>
      <td className={`py-2 text-f-f text-right font-syne tabular-nums ${bold ? 'font-bold text-beacon-green' : 'text-access-white/60'}`}>
        {fmt(value, 'currency')}
      </td>
    </tr>
  );
}

function MetricCard({ label, value, sub, green = false }: { label: string; value: string; sub?: string; green?: boolean }) {
  return (
    <div className="bg-access-white/5 border border-access-white/10 rounded-a p-5 flex flex-col min-h-[120px]">
      <div className={`text-f-b font-bold font-hubot mb-2 ${green ? 'text-beacon-green' : 'text-access-white'}`}>
        {value}
      </div>
      <div className="text-f-f font-semibold text-access-white font-syne leading-snug">{label}</div>
      {sub && <div className="text-f-g text-access-white/50 font-syne mt-1">{sub}</div>}
    </div>
  );
}

export default function ResultsPanel({ outputs }: Props) {
  if (!outputs.is_complete) {
    return (
      <div className="text-center py-16 text-access-white/40 font-syne text-f-f">
        Complete the form above to see your results.
      </div>
    );
  }

  const { time, dollars, assumptions } = outputs;
  const timeSavedPct = Math.round(time.time_saved_percent.expected);

  return (
    <div id="results-section">
      {/* Hero metrics */}
      <div className="grid grid-cols-2 tabletm:grid-cols-4 gap-4 mb-10 items-stretch">
        <MetricCard
          label="Baseline Recovery"
          value={fmtHours(time.baseline_elapsed_hours.expected)}
          sub="your current baseline"
        />
        <MetricCard
          label="With Identity Recovery"
          value={fmtHours(time.with_tool_elapsed_hours.expected)}
          sub="your estimated recovery time"
          green
        />
        <MetricCard
          label="Time Saved"
          value={`${timeSavedPct}%`}
          sub={`~${fmtHours(time.time_saved_hours.expected)} faster`}
          green
        />
        <MetricCard
          label="Expected Annual Value"
          value={fmt(dollars.expected_annual_value.expected, 'currency')}
          sub={`at ${(dollars.incident_probability * 100).toFixed(0)}% annual incident probability`}
          green
        />
      </div>

      {/* Phase breakdown */}
      <div className="mb-10">
        <h3 className="text-f-f font-semibold text-access-white font-hubot mb-4">Your Recovery Phase Breakdown</h3>
        <div className="space-y-3">
          {time.phases.map((phase) => {
            const baseW = Math.min(100, (phase.baseline_hours.expected / time.baseline_elapsed_hours.expected) * 100);
            const toolW = Math.min(100, (phase.with_tool_hours.expected / time.baseline_elapsed_hours.expected) * 100);
            return (
              <div key={phase.phase_id}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-f-g font-semibold text-access-white/80 font-syne">{phase.label}</span>
                  <span className="text-f-g text-access-white/40 font-syne tabular-nums">
                    {fmtHours(phase.with_tool_hours.expected)} vs {fmtHours(phase.baseline_hours.expected)}
                  </span>
                </div>
                <div className="relative h-2 bg-access-white/10 rounded-a overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-access-white/20 rounded-a"
                    style={{ width: `${baseW}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-beacon-green rounded-a"
                    style={{ width: `${toolW}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-f-g text-access-white/50 font-syne">
            <span className="w-3 h-2 rounded-a bg-access-white/20 inline-block" /> Without Identity Recovery
          </span>
          <span className="flex items-center gap-1.5 text-f-g text-access-white/50 font-syne">
            <span className="w-3 h-2 rounded-a bg-beacon-green inline-block" /> With Identity Recovery
          </span>
        </div>
      </div>

      {/* Financial breakdown table */}
      <div className="mb-10">
        <h3 className="text-f-f font-semibold text-access-white font-hubot mb-4">Your Financial Impact</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              <tr>
                <td colSpan={2} className="pt-1 pb-1 text-f-g font-semibold text-access-white/30 font-syne uppercase tracking-wider">
                  If an incident occurs
                </td>
              </tr>
              <ValueRow
                label={dollars.disruption_driver === 'revenue' ? 'Revenue at Risk Avoided' : 'Workforce Productivity Loss Avoided'}
                value={dollars.business_disruption_avoided}
              />
              <ValueRow label="Recovery Team Labor Avoided" value={dollars.recovery_team_labor_avoided} />
              {dollars.external_services_avoided.expected > 0 && (
                <ValueRow label="External Services Avoided" value={dollars.external_services_avoided} />
              )}
              <ValueRow label="Total If Incident Occurs"    value={dollars.total_event_value} highlight />
              <tr>
                <td colSpan={2} className="pt-5 pb-1 text-f-g font-semibold text-access-white/30 font-syne uppercase tracking-wider">
                  Probability-adjusted annual value
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-f-f font-syne text-access-white/50">Incident Probability</td>
                <td className="py-2 text-f-f text-right font-syne text-access-white/50">
                  {(dollars.incident_probability * 100).toFixed(0)}% per year
                </td>
              </tr>
              <ValueRow label="Expected Annual Value" value={dollars.expected_annual_value} highlight />
              <ValueRow label="ROI"                   value={dollars.roi_percent}           format="percent" highlight />
              <ValueRow label="Payback Period"        value={dollars.payback_period_months} format="months"  highlight />
            </tbody>
          </table>
        </div>
      </div>

      {/* TCO breakdown */}
      {outputs.tco && (
        <div className="mb-10">
          <h3 className="text-f-f font-semibold text-access-white font-hubot mb-2">Your Total Cost of Ownership</h3>
          <p className="text-f-g text-access-white/50 font-syne mb-4">
            Annual non-license ownership costs — infrastructure, storage, staffing overhead, and restore testing. Excludes software license cost.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                <tr>
                  <td colSpan={2} className="pt-1 pb-1 text-f-g font-semibold text-access-white/30 font-syne uppercase tracking-wider">
                    Annual recurring
                  </td>
                </tr>
                <SimpleTCORow label="Infrastructure"         value={outputs.tco.infrastructure_annual} />
                <SimpleTCORow label="Storage"               value={outputs.tco.storage_annual} />
                <SimpleTCORow
                  label="Admin FTE Overhead"
                  value={outputs.tco.fte_admin_annual}
                  note={`${Math.round(outputs.tco.resolved.fte_admin_fraction * 100)}% FTE @ $${outputs.tco.resolved.fte_admin_hourly_rate}/hr`}
                />
                <SimpleTCORow
                  label="Annual Restore Testing"
                  value={outputs.tco.restore_test_annual}
                  note={`${outputs.tco.resolved.restore_test_hours}h @ $${outputs.tco.resolved.fte_admin_hourly_rate}/hr`}
                />
                <tr className="border-t border-access-white/10">
                  <td className="py-3 pr-4 text-f-f font-semibold text-access-white font-syne">
                    Non-License Annual Overhead
                  </td>
                  <td className="py-3 text-f-f text-right font-bold text-beacon-green font-syne tabular-nums">
                    {fmt(outputs.tco.non_license_annual_subtotal, 'currency')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-f-g text-access-white/30 font-syne mt-2">
            Excludes software license cost. Contact your Netwrix representative for pricing.
          </p>
        </div>
      )}

      {/* Probability note */}
      <div className="mb-6 bg-access-white/5 border border-access-white/10 rounded-a px-4 py-3 flex items-start gap-3">
        <span className="text-access-white/40 text-f-f mt-0.5">ℹ</span>
        <p className="text-f-g text-access-white/50 font-syne leading-relaxed">
          Annual value is probability-adjusted at <span className="text-access-white/80 font-semibold">{(dollars.incident_probability * 100).toFixed(0)}% annual incident probability</span> — the estimated likelihood of a major AD compromise requiring forest-level recovery in any given year, deliberately conservative relative to broader ransomware exposure (59% of organizations, Sophos 2024; 44% of breaches, Verizon DBIR 2025). Adjust this in <span className="text-access-white/80 font-semibold">detailed assumptions</span> if your risk profile differs.
        </p>
      </div>

      {/* Cost per day */}
      <div className="mb-6 bg-access-white/5 border border-access-white/10 rounded-a px-4 py-3 flex items-start gap-3">
        <span className="text-access-white/40 text-f-f mt-0.5">$</span>
        <p className="text-f-g text-access-white/50 font-syne leading-relaxed">
          <>Your non-license overhead runs <span className="text-access-white/80 font-semibold">{fmt((outputs.tco ? outputs.tco.non_license_annual_subtotal : assumptions.product_annual_cost_usd) / 365, 'currency')}/day</span> — covering infrastructure, storage, staffing, and restore testing.</>
        </p>
      </div>

      {/* Methodology note */}
      <div className="border-t border-access-white/5 pt-4 space-y-2">
        <p className="text-f-g text-access-white/30 font-syne leading-relaxed">
          <span className="text-access-white/50 font-semibold">Scope: </span>
          These estimates cover the time to restore Active Directory to an operational state — domain controllers and core AD services (FSMO, replication, SYSVOL, DNS). Credential hygiene (KRBTGT rotation, privileged and service account resets) is not automated by Identity Recovery and appears as a fixed overhead in both scenarios. Once AD is operational, your team can begin restoring dependent services such as Azure AD Connect, ADFS, PKI, and LDAP-dependent applications.
        </p>
        <p className="text-f-g text-access-white/30 font-syne leading-relaxed">
          Results are estimates only. All assumptions are editable in the detailed view.
        </p>
      </div>
    </div>
  );
}
