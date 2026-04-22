import React, { useState } from 'react';
import type { TCOInputs, EnvironmentSize } from '../types/roi';
import config from '../config/roiConfig.json';

// ── Formatted number input helpers (same pattern as Tier2Form) ────────────────
const numDisplay = (n: number | null | undefined): string =>
  n != null && n > 0 ? n.toLocaleString('en-US') : '';

const numParse = (s: string): number | null => {
  const stripped = s.replace(/[^0-9]/g, '');
  return stripped ? Number(stripped) : null;
};

interface Props {
  values: TCOInputs;
  environmentSize: EnvironmentSize;
  onChange: (values: TCOInputs) => void;
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
  suffix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
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
        className={`w-full bg-surface border border-border rounded-a ${prefix ? 'pl-8' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'} py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15`}
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint font-syne text-f-f">{suffix}</span>
      )}
    </div>
  );
}

export default function TCOForm({ values, environmentSize, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const td = (config as any).tco_defaults;
  const sz = environmentSize;

  function set<K extends keyof TCOInputs>(key: K, val: TCOInputs[K]) {
    onChange({ ...values, [key]: val });
  }

  // Compute placeholders from config defaults for the current environment size
  const infPlaceholder  = td.infrastructure_annual_usd.toLocaleString('en-US');
  const stoPlaceholder  = td.storage_annual_by_size[sz].toLocaleString('en-US');
  const ftePct          = Math.round(td.fte_admin_fraction_by_size[sz] * 100);

  return (
    <div className="mb-8 bg-surface-subtle border border-border rounded-a overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-surface-hover transition-standard"
      >
        <span className="text-f-f font-semibold text-nightwatch font-hubot">
          TCO Assumptions{' '}
          <span className="font-normal text-text-faint text-f-g ml-1">Total Cost of Ownership</span>
        </span>
        <span className="text-text-faint text-f-d">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2">
          <p className="text-f-f text-text-muted font-syne mb-6">
            Adjust these fields to reflect your actual infrastructure, staffing, and deployment costs. Defaults are derived from your environment size selection. Leave fields blank to keep the defaults.
          </p>

          <Field
            label="Infrastructure Cost (annual)"
            helpText={`Cost to host your Identity Recovery VM and SQL database. Default: $${infPlaceholder}/yr (single VM, on-prem or cloud).`}
          >
            <NumberInput
              value={values.infrastructure_annual_usd}
              onChange={(v) => set('infrastructure_annual_usd', v)}
              placeholder={infPlaceholder}
              prefix="$"
              suffix="/yr"
            />
          </Field>

          <Field
            label="Storage Cost (annual)"
            helpText={`Your AD backup snapshot storage. Identity Recovery requires at most ~500 GB even in large environments. Default for ${sz}: $${stoPlaceholder}/yr.`}
          >
            <NumberInput
              value={values.storage_annual_usd}
              onChange={(v) => set('storage_annual_usd', v)}
              placeholder={stoPlaceholder}
              prefix="$"
              suffix="/yr"
            />
          </Field>

          <Field
            label="Admin FTE Overhead"
            helpText={`Fraction of your FTE dedicated to monitoring, testing, and maintaining Identity Recovery. Default for ${sz}: ${ftePct}% FTE.`}
          >
            <div className="relative w-full mobile:w-40">
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={values.fte_admin_fraction != null ? Math.round(values.fte_admin_fraction * 100) : ''}
                onChange={(e) =>
                  set('fte_admin_fraction', e.target.value !== '' ? Number(e.target.value) / 100 : null)
                }
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder={String(ftePct)}
                className="w-full bg-surface border border-border rounded-a px-4 pr-10 py-3 text-nightwatch placeholder-text-faint font-syne text-f-f focus:outline-none focus:border-vigilant-blue focus:ring-2 focus:ring-vigilant-blue/15"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-faint font-syne text-f-f">%</span>
            </div>
          </Field>

          <p className="text-f-g text-text-faint font-syne mt-2">
            FTE and restore-test labor rates are inherited from Cost Assumptions above (default: $125/hr). Training is provided free via Netwrix professional services and the product training platform. Product investment is factored into the full-TCO total but is not displayed individually.
          </p>
        </div>
      )}
    </div>
  );
}
