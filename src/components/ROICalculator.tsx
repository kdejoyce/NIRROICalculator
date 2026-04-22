import React, { useState, useEffect, useRef } from 'react';
import type { ROIInputs } from '../types/roi';
import { calculate } from '../lib/roiEngine';
import { getDefaultInputs, inputsToParams, paramsToInputs } from '../lib/urlState';
import { track } from '../lib/analytics';
import Tier1Form from './Tier1Form';
import Tier2Form from './Tier2Form';
import TCOForm from './TCOForm';
import ResultsPanel from './ResultsPanel';
import ExportSummary from './ExportSummary';

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

  const canCalculate = inputs.tier1.employees_total > 0;

  const [copied, setCopied] = useState(false);
  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('copy_link');
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 mobile:px-6 tabletm:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-vigilant-blue/10 border border-vigilant-blue/20 text-vigilant-blue text-f-g font-semibold font-syne px-3 py-1.5 rounded-a mb-4">
          Identity Recovery
        </div>
        <h1 className="text-f-b tablets:text-f-a font-bold font-hubot text-nightwatch mb-3">
          How much could you save with faster AD recovery?
        </h1>
        <p className="text-f-f text-text-muted font-syne max-w-2xl">
          Estimate your financial impact from reducing forest-level Active Directory recovery time after a ransomware, wiper, or domain compromise event.
        </p>
      </div>

      {/* Form section */}
      <div className="bg-surface border border-border shadow-[0_4px_16px_rgba(26,21,54,0.06)] rounded-a p-6 mobile:p-8 mb-8">
        <h2 className="text-f-d font-semibold font-hubot text-nightwatch mb-6">Tell us about your environment</h2>
        <Tier1Form
          values={inputs.tier1}
          onChange={(tier1) => handleInputChange({ ...inputs, tier1 })}
        />

        {/* Customize Assumptions accordion */}
        <div className="mb-4 bg-surface-subtle border border-border rounded-a overflow-hidden">
          <button
            type="button"
            onClick={toggleTier2}
            className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-surface-hover transition-standard"
          >
            <span className="text-f-f font-semibold text-nightwatch font-hubot">
              Customize Assumptions{' '}
              <span className="font-normal text-text-faint text-f-g ml-1">Override defaults</span>
            </span>
            <span className="text-text-faint text-f-d">{showTier2 ? '−' : '+'}</span>
          </button>
          {showTier2 && (
            <div className="px-6 pb-6 pt-2">
              <Tier2Form
                values={inputs.tier2}
                onChange={(tier2) => handleInputChange({ ...inputs, tier2 })}
              />
            </div>
          )}
        </div>

        {/* TCO Assumptions */}
        <TCOForm
          values={inputs.tco}
          environmentSize={inputs.tier1.environment_size}
          onChange={(tco) => handleInputChange({ ...inputs, tco })}
        />

        {/* Calculate button + copy link */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCalculate}
            disabled={!canCalculate}
            className="w-full mobile:w-auto bg-vigilant-blue hover:bg-vigilant-blue/80 disabled:opacity-40 disabled:cursor-not-allowed text-access-white font-semibold font-syne text-f-f px-10 py-3.5 rounded-a transition-standard"
          >
            Calculate My ROI →
          </button>
          {canCalculate && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 text-f-f font-syne text-text-faint hover:text-text-muted transition-standard"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-beacon-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-beacon-green">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Copy shareable link
                </>
              )}
            </button>
          )}
        </div>
        {!canCalculate && (
          <p className="text-f-g text-text-faint font-syne mt-2">Enter your employee count to get started.</p>
        )}
      </div>

      {/* Results section — only shown after Calculate is clicked */}
      {submittedOutputs && (
        <div ref={resultsRef} className="bg-nightwatch border border-access-white/10 rounded-a p-6 mobile:p-8">
          <h2 className="text-f-d font-semibold font-hubot text-access-white mb-6">Your ROI Estimate</h2>
          <ResultsPanel outputs={submittedOutputs} />
          {submittedOutputs.is_complete && (
            <ExportSummary inputs={inputs} outputs={submittedOutputs} onBack={() => setSubmittedOutputs(null)} />
          )}
        </div>
      )}

      {/* Footer CTA */}
      {submittedOutputs?.is_complete && (
        <div className="mt-8 text-center">
          <p className="text-f-f text-text-muted font-syne mb-4">
            Ready to validate these numbers with your specific environment?
          </p>
          <a
            href="https://www.netwrix.com/identity-recovery.html"
            onClick={() => track('cta_clicked', { location: 'footer' })}
            className="inline-flex items-center gap-2 bg-beacon-green hover:bg-beacon-green/80 text-nightwatch font-semibold font-syne text-f-f px-8 py-3.5 rounded-a transition-standard"
          >
            Talk to an Identity Recovery Expert
          </a>
        </div>
      )}
    </div>
  );
}
