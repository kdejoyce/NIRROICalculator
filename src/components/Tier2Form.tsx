import React, { useState } from 'react';
import type { Tier2Overrides } from '../types/roi';

// ── Formatted number input helpers ───────────────────────────────────────────
const numDisplay = (n: number | null | undefined): string =>
  n != null && n > 0 ? n.toLocaleString('en-US') : '';

const numParse = (s: string): number | null => {
  const stripped = s.replace(/[^0-9]/g, '');
  return stripped ? Number(stripped) : null;
};

interface Props {
  values: Tier2Overrides;
  onChange: (values: Tier2Overrides) => void;
}

function Field({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <label className="block text-f-f font-semibold text-nightwatch mb-1 font-syne">{label}</label>
      {helpText && <p className="text-f-g text-text-muted mb-2 font-syne">{helpText}</p>}
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  prefix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div className="relative w-full mobile:w-56">
      {prefix && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint font-syne text-f-f">{prefix}</span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={numDisplay(value)}
        onChange={(e) => onChange(numParse(e.target.value))}
        placeholder={placeholder}
        className={`w-full bg-surface border border-border rounded-a ${prefix ? 'pl-8' : 'pl-4'} pr-4 py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15`}
      />
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-3">
      {(['yes', 'no'] as const).map((opt) => {
        const active = opt === 'yes' ? value === true : value === false;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === 'yes')}
            className={`px-5 py-2 rounded-a border text-f-f font-semibold font-syne transition-standard ${
              active
                ? 'border-2 border-vigilant-blue bg-accent-fill text-vigilant-blue'
                : 'border-border bg-surface text-text-muted hover:border-text-faint'
            }`}
          >
            {opt === 'yes' ? 'Yes' : 'No'}
          </button>
        );
      })}
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full mobile:w-64 bg-surface border border-border rounded-a px-4 py-3 text-nightwatch font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15 appearance-none"
    >
      <option value="" disabled className="bg-surface text-text-faint">Select…</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface text-nightwatch">{o.label}</option>
      ))}
    </select>
  );
}

type SectionId = 'environment' | 'readiness' | 'costs';

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8 bg-surface-subtle border border-border rounded-a overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-surface-hover transition-standard"
      >
        <span className="text-f-f font-semibold text-nightwatch font-hubot">{title}</span>
        <span className="text-text-faint text-f-d">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}

export default function Tier2Form({ values, onChange }: Props) {
  const [sections, setSections] = useState<Record<SectionId, boolean>>({
    environment: true,
    readiness: true,
    costs: true,
  });

  function set<K extends keyof Tier2Overrides>(key: K, val: Tier2Overrides[K]) {
    onChange({ ...values, [key]: val });
  }

  function toggleSection(key: SectionId) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div>
      <p className="text-f-f text-text-muted font-syne mb-6">
        Refine any proxy dimension below. Only fields you change will override the defaults derived from your Tier 1 selections. Leave fields blank to keep using calculated defaults.
      </p>

      <Section id="environment" title="Environment Detail" open={sections.environment} onToggle={toggleSection}>
        <Field label="Domain Controller Count" helpText="Total DCs across all domains in scope. Overrides the environment size proxy for DC-restoration and core AD phases.">
          <NumberInput value={values.dc_count} onChange={(v) => set('dc_count', v)} placeholder="e.g. 30" />
        </Field>
      </Section>

      <Section id="readiness" title="Recovery Readiness Detail" open={sections.readiness} onToggle={toggleSection}>
        <Field label="Backup Frequency">
          <Select
            value={values.backup_frequency}
            onChange={(v) => set('backup_frequency', v)}
            options={[
              { value: 'daily',  label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'other',  label: 'Other / Unknown' },
            ]}
          />
        </Field>
        <Field label="Documented AD Recovery Runbook Exists?">
          <Toggle value={values.runbook_exists} onChange={(v) => set('runbook_exists', v)} />
        </Field>
        <Field label="Last Backup Restore Test">
          <Select
            value={values.last_restore_test}
            onChange={(v) => set('last_restore_test', v)}
            options={[
              { value: 'never',          label: 'Never tested' },
              { value: 'over_1yr',       label: 'Over a year ago' },
              { value: 'within_1yr',     label: 'Within the last year' },
              { value: 'within_quarter', label: 'Within the last quarter' },
            ]}
          />
        </Field>
        <Field label="Staff with AD Recovery Experience">
          <Select
            value={values.staff_experience}
            onChange={(v) => set('staff_experience', v)}
            options={[
              { value: 'none', label: 'None' },
              { value: '1-2',  label: '1–2 people' },
              { value: '3+',   label: '3 or more people' },
            ]}
          />
        </Field>
        <Field label="Segregated Recovery Environment Available?">
          <Toggle value={values.segregated_env_available} onChange={(v) => set('segregated_env_available', v)} />
        </Field>
      </Section>

      <Section id="costs" title="Cost Assumptions" open={sections.costs} onToggle={toggleSection}>
        <Field label="Workforce Impact %" helpText="What percent of employees are impacted when AD is down? (0–100)">
          <div className="relative w-full mobile:w-40">
            <input
              type="number"
              min={0}
              max={100}
              value={values.workforce_impact_percent != null ? Math.round(values.workforce_impact_percent * 100) : ''}
              onChange={(e) => set('workforce_impact_percent', e.target.value ? Number(e.target.value) / 100 : null)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="85"
              className="w-full bg-surface border border-border rounded-a px-4 pr-8 py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint font-syne text-f-f">%</span>
          </div>
        </Field>
        <Field label="Fully Loaded Employee Hourly Cost" helpText="Average total hourly cost per employee including benefits. Default: $65.">
          <NumberInput value={values.fully_loaded_hourly_rate_usd} onChange={(v) => set('fully_loaded_hourly_rate_usd', v)} placeholder="65" prefix="$" />
        </Field>
        <Field label="Internal IT / IR Hourly Rate" helpText="Blended hourly rate for AD engineers and security IR staff. Default: $125.">
          <NumberInput value={values.internal_ir_hourly_rate_usd} onChange={(v) => set('internal_ir_hourly_rate_usd', v)} placeholder="125" prefix="$" />
        </Field>
        <Field label="External SI Hourly Rate" helpText="Hourly rate for external services / consulting firm. Default: $250.">
          <NumberInput value={values.external_si_hourly_rate_usd} onChange={(v) => set('external_si_hourly_rate_usd', v)} placeholder="250" prefix="$" />
        </Field>
        <Field label="Annual Product Cost Override" helpText={`Default is $12.50 × employee count. Enter a value here only if you have a custom contract price.`}>
          <NumberInput value={values.product_annual_cost_usd} onChange={(v) => set('product_annual_cost_usd', v)} placeholder="e.g. 62500" prefix="$" />
        </Field>
        <Field label="Annual Incident Probability (%)" helpText="Estimated likelihood of a major AD compromise requiring forest-level recovery in any given year. Default: 5% (~once per 20 years).">
          <div className="relative w-full mobile:w-40">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={values.incident_probability_per_year != null ? Math.round(values.incident_probability_per_year * 100 * 10) / 10 : ''}
              onChange={(e) => set('incident_probability_per_year', e.target.value ? Number(e.target.value) / 100 : null)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="5"
              className="w-full bg-surface border border-border rounded-a px-4 pr-8 py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint font-syne text-f-f">%</span>
          </div>
        </Field>
      </Section>
    </div>
  );
}
