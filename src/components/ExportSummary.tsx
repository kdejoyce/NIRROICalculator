import { useState } from 'react';
import type { ROIInputs, ROIOutputs } from '../types/roi';
import { track } from '../lib/analytics';

interface Props {
  inputs: ROIInputs;
  outputs: ROIOutputs;
  onBack: () => void;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number, style: 'currency' | 'percent' = 'currency'): string {
  if (!isFinite(n)) return '—';
  if (style === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }
  return `${n.toFixed(0)}%`;
}

function fmtHours(h: number): string {
  if (h < 24) return `${Math.round(h)} hours`;
  return `${(h / 24).toFixed(1)} days`;
}

// ── Print document builder (fully inline-styled, no external CSS) ─────────────

const C = {
  nightwatch: '#1A1536',   // DS $a
  white:      '#FCFAF5',   // DS $b
  blue:       '#5851DB',   // DS $c
  green:      '#41F27C',   // DS $d
  bodyText:   '#4D4D4D',   // DS $h
  gray50:     '#F9FAFB',   // custom surface
  gray100:    '#F3F4F6',   // custom surface-hover
  gray400:    '#9CA3AF',   // custom text-faint
  gray500:    '#6B7280',   // custom text-muted
};

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 16px 7px 0;color:${C.gray500};font-size:13px;border-bottom:1px solid ${C.gray100};width:200px;">${label}</td>
    <td style="padding:7px 0;font-weight:600;font-size:13px;color:${C.nightwatch};border-bottom:1px solid ${C.gray100};">${value}</td>
  </tr>`;
}

function resultsRow(label: string, value: string, bold = false): string {
  const bt = bold ? `border-top:2px solid ${C.nightwatch};` : `border-bottom:1px solid ${C.gray100};`;
  const lc = bold ? C.nightwatch : C.gray500;
  const lw = bold ? '700' : '400';
  const vw = bold ? '700' : '600';
  return `<tr style="${bt}">
    <td style="padding:8px 16px 8px 0;font-size:13px;color:${lc};font-weight:${lw};">${label}</td>
    <td style="padding:8px 0;text-align:right;font-size:13px;color:${C.nightwatch};font-weight:${vw};">${value}</td>
  </tr>`;
}

function timeCard(label: string, value: string, sub: string, dark: boolean): string {
  const bg  = dark ? C.nightwatch : 'white';
  const vc  = dark ? C.green      : C.nightwatch;
  const lc  = dark ? C.white      : C.nightwatch;
  const sc  = dark ? 'rgba(252,250,245,0.5)' : C.gray400;
  const brd = dark ? '' : `border:1px solid ${C.gray100};`;
  return `<div style="background:${bg};${brd}border-radius:4px;padding:20px 18px;">
    <div style="font-family:'Hubot Sans',sans-serif;font-size:22px;font-weight:700;color:${vc};margin-bottom:4px;">${value}</div>
    <div style="font-size:11px;font-weight:600;color:${lc};margin-bottom:2px;">${label}</div>
    <div style="font-size:11px;color:${sc};">${sub}</div>
  </div>`;
}

function valueCard(label: string, value: string): string {
  return `<div style="background:${C.blue};border-radius:4px;padding:20px 18px;">
    <div style="font-family:'Hubot Sans',sans-serif;font-size:22px;font-weight:700;color:${C.white};margin-bottom:4px;">${value}</div>
    <div style="font-size:11px;font-weight:600;color:rgba(252,250,245,0.7);">${label}</div>
  </div>`;
}

function sectionHead(title: string): string {
  return `<h2 style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;color:${C.blue};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">${title}</h2>`;
}

function buildPrintHTML(
  form: { name: string; email: string; company: string },
  inputs: ROIInputs,
  outputs: ROIOutputs,
): string {
  const { time, dollars, assumptions } = outputs;
  const t1 = inputs.tier1;
  const envLabel      = t1.environment_size.charAt(0).toUpperCase()   + t1.environment_size.slice(1);
  const readinessLabel = t1.recovery_readiness.charAt(0).toUpperCase() + t1.recovery_readiness.slice(1);
  const timeSavedPct  = Math.round(time.time_saved_percent.expected);
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const preparedFor = (form.name || form.company)
    ? `<div style="background:rgba(252,250,245,0.08);border:1px solid rgba(252,250,245,0.15);border-radius:4px;padding:18px 22px;min-width:170px;flex-shrink:0;">
        <p style="font-size:10px;font-weight:600;color:rgba(252,250,245,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Prepared for</p>
        ${form.name    ? `<p style="font-size:14px;font-weight:600;color:${C.white};">${form.name}</p>` : ''}
        ${form.company ? `<p style="font-size:13px;color:rgba(252,250,245,0.7);">${form.company}</p>` : ''}
        ${form.email   ? `<p style="font-size:12px;color:rgba(252,250,245,0.5);margin-top:4px;">${form.email}</p>` : ''}
       </div>`
    : '';

  const payback = isFinite(dollars.payback_period_months.expected)
    ? `${dollars.payback_period_months.expected.toFixed(1)} months` : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Identity Recovery ROI Summary – Netwrix</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hubot+Sans:wght@400;500;600;700&family=Syne:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Syne',sans-serif;background:${C.white};color:${C.nightwatch};}
    table{border-collapse:collapse;width:100%;}
    @page{size:A4 portrait;margin:0;}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  </style>
</head>
<body>

<!-- Header -->
<div style="background:${C.nightwatch};padding:36px 40px 30px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
    <div>
      <div style="font-family:'Hubot Sans',sans-serif;font-size:22px;font-weight:700;color:${C.white};letter-spacing:-0.02em;margin-bottom:18px;">netwrix</div>
      <h1 style="font-family:'Hubot Sans',sans-serif;font-size:26px;font-weight:700;color:${C.white};line-height:1.25;margin-bottom:8px;">Your Identity Recovery<br>ROI Summary</h1>
      <p style="font-size:13px;color:rgba(252,250,245,0.5);">Netwrix Identity Recovery &nbsp;·&nbsp; ${date}</p>
    </div>
    ${preparedFor}
  </div>
</div>

<!-- Accent bar -->
<div style="height:4px;background:${C.blue};"></div>

<!-- Body -->
<div style="padding:28px 40px 32px;background:${C.white};">

  <!-- Time metric cards -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
    ${timeCard('Baseline Recovery',     fmtHours(time.baseline_elapsed_hours.expected),  'your current baseline', false)}
    ${timeCard('With Identity Recovery', fmtHours(time.with_tool_elapsed_hours.expected), 'your estimated recovery time',   true)}
    ${timeCard('Time Saved',            `${timeSavedPct}%`,                               `~${fmtHours(time.time_saved_hours.expected)} faster`, true)}
  </div>

  <!-- Executive summary -->
  <div style="border-left:4px solid ${C.blue};padding-left:18px;margin-bottom:20px;">
    <h2 style="font-family:'Hubot Sans',sans-serif;font-size:14px;font-weight:700;color:${C.nightwatch};margin-bottom:8px;">Executive Summary</h2>
    <p style="font-size:13px;color:${C.bodyText};line-height:1.75;">
      Based on your <strong style="color:${C.nightwatch};">${envLabel}</strong> Active Directory environment with
      <strong style="color:${C.nightwatch};">${readinessLabel.toLowerCase()}</strong> recovery readiness,
      Netwrix Identity Recovery is estimated to restore your AD to an operational state in
      <strong style="color:${C.nightwatch};">${fmtHours(time.with_tool_elapsed_hours.expected)}</strong> —
      compared to <strong style="color:${C.nightwatch};">${fmtHours(time.baseline_elapsed_hours.expected)}</strong> without the tool —
      a reduction of approximately <strong style="color:${C.nightwatch};">${timeSavedPct}%</strong>.
      If an incident occurs, your expected total savings are
      <strong style="color:${C.nightwatch};">${fmt(dollars.total_event_value.expected)}</strong>.
      At a <strong style="color:${C.nightwatch};">${(dollars.incident_probability * 100).toFixed(0)}%</strong> annual incident probability,
      your probability-adjusted expected annual value is <strong style="color:${C.nightwatch};">${fmt(dollars.expected_annual_value.expected)}</strong>,
      yielding your estimated ROI of <strong style="color:${C.nightwatch};">${fmt(dollars.roi_percent.expected, 'percent')}</strong>
      and a payback period of <strong style="color:${C.nightwatch};">${payback}</strong>.
    </p>
  </div>

  <!-- Financial value cards -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
    ${valueCard('Expected Annual Value', fmt(dollars.expected_annual_value.expected))}
    ${valueCard('Estimated ROI',         fmt(dollars.roi_percent.expected, 'percent'))}
    ${valueCard('Payback Period',        isFinite(dollars.payback_period_months.expected) ? `${dollars.payback_period_months.expected.toFixed(1)} mo` : '—')}
  </div>

  <!-- Environment + Results (side by side) -->
  <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:32px;margin-bottom:20px;align-items:start;">
    <div>
      ${sectionHead('Your Environment')}
      <table>
        <tbody>
          ${row('Total Employees',             t1.employees_total.toLocaleString())}
          ${row('Environment Size',            envLabel)}
          ${row('Recovery Readiness',          readinessLabel)}
          ${row('Annual Incident Probability', `${(t1.incident_probability_per_year * 100).toFixed(0)}%`)}
          ${row('Annual Revenue',              t1.annual_revenue_usd ? fmt(t1.annual_revenue_usd) : 'Not provided')}
          ${row('External SI Engaged',         t1.external_si_engaged ? 'Yes' : 'No')}
        </tbody>
      </table>
    </div>
    <div>
      ${sectionHead('Detailed Results')}
      <table>
        <tbody>
          ${resultsRow('Baseline Recovery Time',    fmtHours(time.baseline_elapsed_hours.expected))}
          ${resultsRow('With Identity Recovery',    fmtHours(time.with_tool_elapsed_hours.expected))}
          ${resultsRow('Time Saved',                fmtHours(time.time_saved_hours.expected))}
          ${resultsRow(dollars.disruption_driver === 'revenue' ? 'Revenue at Risk Avoided' : 'Workforce Productivity Loss Avoided', fmt(dollars.business_disruption_avoided.expected))}
          ${resultsRow('Recovery Team Labor Avoided', fmt(dollars.recovery_team_labor_avoided.expected))}
          ${dollars.external_services_avoided.expected > 0 ? resultsRow('External Services Avoided', fmt(dollars.external_services_avoided.expected)) : ''}
          ${resultsRow('Total If Incident Occurs',    fmt(dollars.total_event_value.expected), true)}
          ${resultsRow(`Expected Annual Value (${(dollars.incident_probability * 100).toFixed(0)}% probability)`, fmt(dollars.expected_annual_value.expected), true)}
          ${resultsRow('ROI',                         fmt(dollars.roi_percent.expected, 'percent'), true)}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Assumptions (flat 4-column grid) -->
  ${sectionHead('Assumptions Used')}
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
    ${[
      ['Workforce Impact',    `${Math.round(assumptions.workforce_impact_percent * 100)}%`],
      ['Employee Hourly Rate', fmt(assumptions.fully_loaded_hourly_rate_usd)],
      ['Internal IT/IR Rate',  fmt(assumptions.internal_ir_hourly_rate_usd)],
      ['External SI Rate',     fmt(assumptions.external_si_hourly_rate_usd)],
    ].map(([label, value]) => `
      <div style="background:${C.gray50};border:1px solid ${C.gray100};border-radius:4px;padding:12px 14px;">
        <div style="font-size:11px;color:${C.gray400};margin-bottom:4px;">${label}</div>
        <div style="font-size:14px;font-weight:700;color:${C.nightwatch};">${value}</div>
      </div>`).join('')}
  </div>

  ${outputs.tco ? `
  <!-- TCO section -->
  ${sectionHead('Your Non-License Ownership Costs')}
  <table style="margin-bottom:8px;">
    <tbody>
      ${row('Infrastructure',         fmt(outputs.tco.infrastructure_annual))}
      ${row('Storage',                fmt(outputs.tco.storage_annual))}
      ${row('Admin FTE Overhead',     fmt(outputs.tco.fte_admin_annual))}
      ${row('Annual Restore Testing', fmt(outputs.tco.restore_test_annual))}
      <tr style="border-top:2px solid ${C.nightwatch};">
        <td style="padding:8px 16px 8px 0;font-size:13px;font-weight:700;color:${C.nightwatch};">Annual Overhead Subtotal</td>
        <td style="padding:8px 0;font-weight:700;font-size:13px;color:${C.blue};">${fmt(outputs.tco.non_license_annual_subtotal)}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:11px;color:${C.gray400};margin-bottom:20px;">Excludes software license cost. Contact your Netwrix representative for pricing.</p>
  ` : ''}

  <!-- Disclaimer -->
  <div style="background:${C.gray50};border:1px solid ${C.gray100};border-radius:4px;padding:14px 16px;margin-bottom:20px;">
    <p style="font-size:11px;color:${C.gray500};line-height:1.75;margin:0;">
      <strong style="color:${C.bodyText};">Disclaimer: </strong>
      This document is for informational purposes only and does not constitute a commitment from Netwrix Corporation of any return on investment from the Netwrix products or services. Netwrix hereby disclaims all warranties related to the information in this document, whether express or implied, including but not limited to the implied warranties of merchantability and fitness for a particular purpose.
      This document does not provide you with any legal rights whatsoever including, without limitation, with respect to the information you submitted to generate an estimated return on investment or the estimated return on investment generated by that information. You may copy and use this document only for your internal, reference purposes.
    </p>
  </div>

  <!-- CTA -->
  <div style="background:${C.nightwatch};border-radius:4px;padding:20px 24px;margin-bottom:24px;text-align:center;">
    <p style="font-family:'Hubot Sans',sans-serif;font-size:14px;font-weight:700;color:${C.white};margin-bottom:6px;">
      See how Netwrix Identity Recovery can protect your organization
    </p>
    <p style="font-size:13px;color:rgba(252,250,245,0.65);margin:0;">
      Visit <strong style="color:${C.white};">netwrix.com</strong> or contact your Netwrix representative.
    </p>
  </div>

</div>

<!-- Footer -->
<div style="background:${C.nightwatch};padding:22px 40px;">
  <p style="font-size:11px;color:rgba(252,250,245,0.45);line-height:1.7;margin-bottom:6px;">
    <span style="color:rgba(252,250,245,0.6);font-weight:600;">Methodology: </span>
    Results are based on a phase-by-phase AD forest recovery model calibrated against real-world recovery engagement data.
    Values reflect expected outcomes based on your environment size and recovery readiness inputs.
    The default 5% annual incident probability is deliberately conservative, reflecting only incidents severe enough to require full AD forest recovery — not all ransomware events.
    This summary is an estimate only and does not constitute a guarantee of results.
    Actual outcomes will vary based on specific environment characteristics, incident severity, and other factors.
  </p>
  <p style="font-size:10px;color:rgba(252,250,245,0.35);line-height:1.7;margin-bottom:6px;">
    <span style="color:rgba(252,250,245,0.5);font-weight:600;">Sources: </span>
    U.S. Bureau of Labor Statistics, Employer Costs for Employee Compensation (2025);
    Forrester Total Economic Impact studies (2024);
    Sophos State of Ransomware (2025);
    Verizon Data Breach Investigations Report (2025);
    Microsoft AD Forest Recovery Guide;
    ESG validation research (2024).
  </p>
  <p style="font-size:11px;color:rgba(252,250,245,0.25);">© ${new Date().getFullYear()} Netwrix Corporation &nbsp;·&nbsp; netwrix.com/identity-recovery</p>
</div>

</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportSummary({ inputs, outputs, onBack }: Props) {
  const [printing, setPrinting] = useState(false);

  function openPrintWindow() {
    setPrinting(true);
    const html = buildPrintHTML({ name: '', email: '', company: '' }, inputs, outputs);
    const popup = window.open('', '_blank', 'width=920,height=720');
    if (!popup) { setPrinting(false); return; }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    // Wait for Google Fonts to load before triggering print
    setTimeout(() => {
      popup.focus();
      popup.print();
      setPrinting(false);
    }, 1200);
  }

  return (
    <div className="mt-10 border-t border-access-white/10 pt-8">
      <div className="flex flex-col items-start gap-3">
        <button
          onClick={() => { track('export_started', { method: 'print' }); openPrintWindow(); }}
          disabled={printing}
          className="inline-flex items-center gap-2 bg-vigilant-blue hover:bg-vigilant-blue/80 text-access-white font-semibold font-syne text-f-f px-6 py-3 rounded-a transition-standard disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          {printing ? 'Preparing…' : 'Download PDF Summary'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-text-faint hover:text-body-text font-syne text-f-f transition-standard"
        >
          ← Adjust inputs
        </button>
      </div>
    </div>
  );
}
