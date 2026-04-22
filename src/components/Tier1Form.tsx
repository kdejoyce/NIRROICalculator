import React from 'react';
import type { Tier1Inputs, EnvironmentSize, ReadinessLevel } from '../types/roi';
import config from '../config/roiConfig.json';

interface Props {
  values: Tier1Inputs;
  onChange: (values: Tier1Inputs) => void;
}

interface CardOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

function CardSelector<T extends string>({
  label,
  helpText,
  options,
  value,
  onChange,
}: {
  label: string;
  helpText?: string;
  options: CardOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-8">
      <label className="block text-f-f font-semibold text-nightwatch mb-1 font-syne">{label}</label>
      {helpText && <p className="text-f-g text-text-muted mb-3 font-syne">{helpText}</p>}
      <div className="grid grid-cols-1 mobile:grid-cols-2 tabletm:grid-cols-4 gap-3">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`text-left rounded-a border p-4 transition-standard focus:outline-none ${
                selected
                  ? 'border-2 border-vigilant-blue bg-accent-fill'
                  : 'border-border bg-surface hover:border-text-faint'
              }`}
            >
              <span className={`block text-f-f font-semibold mb-1 font-syne ${selected ? 'text-vigilant-blue' : 'text-nightwatch'}`}>
                {opt.label}
              </span>
              <span className="block text-f-g text-text-muted font-syne leading-relaxed">
                {opt.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Formatted number input helpers ───────────────────────────────────────────
const numDisplay = (n: number | null | undefined): string =>
  n != null && n > 0 ? n.toLocaleString('en-US') : '';

const numParse = (s: string): number | null => {
  const stripped = s.replace(/[^0-9]/g, '');
  return stripped ? Number(stripped) : null;
};

const envSizeOptions: CardOption<EnvironmentSize>[] = Object.entries(config.environment_size_bands).map(
  ([key, val]) => ({ value: key as EnvironmentSize, label: val.label, description: val.description })
);

const readinessOptions: CardOption<ReadinessLevel>[] = Object.entries(config.readiness_levels).map(
  ([key, val]) => ({ value: key as ReadinessLevel, label: val.label, description: val.description })
);


export default function Tier1Form({ values, onChange }: Props) {
  function set<K extends keyof Tier1Inputs>(key: K, val: Tier1Inputs[K]) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div>
      {/* Employees */}
      <div className="mb-8">
        <label className="block text-f-f font-semibold text-nightwatch mb-1 font-syne">
          Total Employees
        </label>
        <p className="text-f-g text-text-muted mb-3 font-syne">
          How many total employees does your organization have?
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={numDisplay(values.employees_total)}
          onChange={(e) => set('employees_total', numParse(e.target.value) ?? 0)}
          placeholder="e.g. 5,000"
          className="w-full mobile:w-64 bg-surface border border-border rounded-a px-4 py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15"
        />
      </div>

      {/* Environment Size */}
      <CardSelector
        label="Active Directory Environment Size"
        helpText="Select the option that best describes your AD footprint."
        options={envSizeOptions}
        value={values.environment_size}
        onChange={(v) => set('environment_size', v)}
      />

      {/* Recovery Readiness */}
      <CardSelector
        label="Recovery Readiness"
        helpText="How prepared is your team for an AD forest recovery today?"
        options={readinessOptions}
        value={values.recovery_readiness}
        onChange={(v) => set('recovery_readiness', v)}
      />

      {/* Annual Revenue (optional) */}
      <div className="mb-8">
        <label className="block text-f-f font-semibold text-nightwatch mb-1 font-syne">
          Annual Revenue <span className="font-normal text-text-faint">(optional)</span>
        </label>
        <p className="text-f-g text-text-muted mb-3 font-syne">
          If your organization generates revenue, enter it here — even an approximation. When AD goes down, every hour the business can't operate has a dollar cost. Without this, the calculator can only count IT labor saved, which understates the real stakes by 5–10x for most companies.
        </p>
        <div className="relative w-full mobile:w-72">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint font-syne text-f-f">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={numDisplay(values.annual_revenue_usd)}
            onChange={(e) => set('annual_revenue_usd', numParse(e.target.value))}
            placeholder="e.g. 500,000,000"
            className="w-full bg-surface border border-border rounded-a pl-8 pr-4 py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15"
          />
        </div>
      </div>

      {/* External SI */}
      <div className="mb-8">
        <label className="block text-f-f font-semibold text-nightwatch mb-2 font-syne">
          External IR / Recovery Firm Engaged?
        </label>
        <p className="text-f-g text-text-muted mb-3 font-syne">
          Would you engage an external services firm to assist with recovery?
        </p>
        <div className="flex gap-3 mb-4">
          {(['yes', 'no'] as const).map((opt) => {
            const active = opt === 'yes' ? values.external_si_engaged : !values.external_si_engaged;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => set('external_si_engaged', opt === 'yes')}
                className={`px-6 py-3 rounded-a border text-f-f font-semibold font-syne transition-standard ${
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

        {values.external_si_engaged && (
          <div>
            <label className="block text-f-g font-semibold text-body-text mb-2 font-syne">
              Estimated external engagement cost <span className="font-normal text-text-faint">(optional)</span>
            </label>
            <div className="relative w-full mobile:w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint font-syne text-f-f">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={numDisplay(values.external_si_estimated_cost_usd)}
                onChange={(e) => set('external_si_estimated_cost_usd', numParse(e.target.value))}
                placeholder="e.g. 100,000"
                className="w-full bg-surface border border-border rounded-a pl-8 pr-4 py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15"
              />
            </div>
            <p className="text-f-g text-text-faint mt-2 font-syne">
              Enter the full engagement cost if known. The calculator applies a 35% savings factor, reflecting the AD forest recovery portion of a typical IR engagement — the scope Identity Recovery replaces. Credential hygiene, dependent service restoration, and forensics remain outside the tool's scope. Leave blank to use a default estimate based on environment size.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
