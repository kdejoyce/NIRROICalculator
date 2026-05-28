import React, { useState, useEffect, useRef } from 'react';
import type { ROIInputs } from '../types/roi';
import { calculate } from '../lib/roiEngine';
import { getDefaultInputs, inputsToParams, paramsToInputs } from '../lib/urlState';
import { track } from '../lib/analytics';
import Tier1Form from './Tier1Form';
import Tier2Form from './Tier2Form';
import TCOForm from './TCOForm';
import ResultsPanel from './ResultsPanel';
import { buildPrintHTML } from './ExportSummary';

function StepCard({
  step,
  title,
  subtitle,
  optional,
  children,
  open,
  onToggle,
}: {
  step: number;
  title: string;
  subtitle?: string;
  optional?: boolean;
  children?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const headerInner = (
    <>
      <div className="w-6 h-6 bg-nightwatch rounded-full flex items-center justify-center text-[11px] font-bold font-syne text-access-white flex-shrink-0">
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold font-hubot text-nightwatch leading-tight">
          {title}
          {optional && <span className="text-[11px] font-normal text-text-faint ml-2">Optional</span>}
        </div>
        {subtitle && <div className="text-[11px] text-text-faint font-syne mt-0.5">{subtitle}</div>}
      </div>
      {onToggle && (
        <span className="text-text-faint text-xl leading-none flex-shrink-0">{open ? '−' : '+'}</span>
      )}
    </>
  );

  return (
    <div className="bg-white border border-border shadow-[0_4px_16px_rgba(26,21,54,0.06)] rounded-a mb-4 overflow-hidden">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="w-full px-6 py-[18px] border-b border-[#F3F4F6] flex items-center gap-3 hover:bg-surface-hover transition-standard text-left"
        >
          {headerInner}
        </button>
      ) : (
        <div className="px-6 py-[18px] border-b border-[#F3F4F6] flex items-center gap-3">
          {headerInner}
        </div>
      )}
      {(onToggle ? open : true) && children && (
        <div className="px-6 py-5">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.toString()) return paramsToInputs(params);
    }
    return getDefaultInputs();
  });

  const [submittedOutputs, setSubmittedOutputs] = useState<ReturnType<typeof calculate> | null>(null);
  const [showTier2, setShowTier2] = useState(false);
  const [showTCO, setShowTCO] = useState(false);
  const [printing, setPrinting] = useState(false);
  const hasInteracted = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Sync URL state (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = inputsToParams(inputs);
      const url = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      window.history.replaceState({}, '', url);
    }, 400);
    return () => clearTimeout(timer);
  }, [inputs]);

  // Track calculator view once
  useEffect(() => {
    track('calculator_view');
  }, []);

  function handleInputChange(updated: ROIInputs) {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      track('first_interaction');
    }
    setInputs(updated);
    setSubmittedOutputs(null);
  }

  // Scroll to results after they render
  useEffect(() => {
    if (!submittedOutputs) return;
    const id = setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(id);
  }, [submittedOutputs]);

  function handleCalculate() {
    const outputs = calculate(inputs);
    setSubmittedOutputs(outputs);
    track('calculate_complete', { tier: inputs.tier });
  }

  function toggleTier2() {
    const next = !showTier2;
    setShowTier2(next);
    setInputs((prev) => ({ ...prev, tier: next ? 'tier2' : 'tier1' }));
    setSubmittedOutputs(null);
    track('tier_switched', { to: next ? 'tier2' : 'tier1' });
  }

  function handlePDF() {
    if (!submittedOutputs) return;
    setPrinting(true);
    const html = buildPrintHTML({ name: '', email: '', company: '' }, inputs, submittedOutputs);
    const popup = window.open('', '_blank', 'width=920,height=720');
    if (!popup) { setPrinting(false); return; }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => { popup.focus(); popup.print(); setPrinting(false); }, 1200);
    track('export_started', { method: 'print' });
  }

  const canCalculate = inputs.tier1.employees_total > 0;

  return (
    <div className="max-w-[760px] mx-auto px-4 mobile:px-6 pb-16">
      {/* Step 1: Environment Profile */}
      <StepCard step={1} title="Environment Profile" subtitle="Your AD environment and workforce">
        <Tier1Form
          values={inputs.tier1}
          onChange={(tier1) => handleInputChange({ ...inputs, tier1 })}
        />
      </StepCard>

      {/* Step 2: Customize Assumptions */}
      <StepCard
        step={2}
        title="Customize Assumptions"
        subtitle="Override default values"
        optional
        open={showTier2}
        onToggle={toggleTier2}
      >
        <Tier2Form
          values={inputs.tier2}
          onChange={(tier2) => handleInputChange({ ...inputs, tier2 })}
        />
      </StepCard>

      {/* Step 3: TCO Assumptions */}
      <StepCard
        step={3}
        title="TCO Assumptions"
        subtitle="Infrastructure and staffing costs"
        optional
        open={showTCO}
        onToggle={() => setShowTCO((o) => !o)}
      >
        <TCOForm
          values={inputs.tco}
          environmentSize={inputs.tier1.environment_size}
          onChange={(tco) => handleInputChange({ ...inputs, tco })}
        />
      </StepCard>

      {/* Submit row */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {!submittedOutputs ? (
          <button
            type="button"
            onClick={handleCalculate}
            disabled={!canCalculate}
            className="ds-btn"
          >
            Calculate My ROI
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setSubmittedOutputs(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="ds-btn ds-btn--second"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Adjust Inputs
            </button>
            <button
              type="button"
              onClick={handlePDF}
              disabled={printing}
              className="ds-btn ds-btn--third"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              {printing ? 'Preparing…' : 'Download PDF Summary'}
            </button>
          </>
        )}
      </div>
      {!submittedOutputs && !canCalculate && (
        <p className="text-f-g text-text-faint font-syne mt-2">Enter your employee count to get started.</p>
      )}

      {/* Results section — only shown after Calculate is clicked */}
      {submittedOutputs && (
        <div ref={resultsRef} className="mt-8 bg-nightwatch border border-access-white/10 rounded-a p-6 mobile:p-8">
          <h2 className="text-f-d font-semibold font-hubot text-access-white mb-6">Your ROI Estimate</h2>
          <ResultsPanel outputs={submittedOutputs} />
        </div>
      )}

    </div>
  );
}
