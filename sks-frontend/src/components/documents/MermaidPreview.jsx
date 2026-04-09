import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

const MermaidPreview = ({ chart }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const diagramId = useId().replace(/:/g, '');

  useEffect(() => {
    let isActive = true;

    const renderChart = async () => {
      if (!chart?.trim()) {
        if (isActive) {
          setSvg('');
          setError('');
        }
        return;
      }

      try {
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'strict',
            themeVariables: {
              primaryColor: '#EEF2FF', // sks-primary-light
              primaryTextColor: '#312E81', // indigo-900
              primaryBorderColor: '#C7D2FE', // indigo-200
              lineColor: '#6366F1', // indigo-500
              secondaryColor: '#F8FAFC', // slate-50
              tertiaryColor: '#ffffff',
              fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif',
            },
          });
          mermaidInitialized = true;
        }

        const result = await mermaid.render(`mermaid-${diagramId}`, chart);

        if (isActive) {
          setSvg(result.svg);
          setError('');
        }
      } catch (renderError) {
        if (isActive) {
          setSvg('');
          setError(
            renderError instanceof Error
              ? renderError.message
              : 'Failed to render Mermaid diagram.',
          );
        }
      }
    };

    void renderChart();

    return () => {
      isActive = false;
    };
  }, [chart, diagramId]);

  if (error) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
        <p className="text-sm font-semibold text-amber-800">Diagram render failed</p>
        <p className="mt-2 text-sm leading-6 text-amber-700">{error}</p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-white/80 p-4 text-xs leading-6 text-slate-700">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return null;
  }

  return (
    <div
      className="overflow-x-auto rounded-[24px] border border-[var(--sks-border)] bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default MermaidPreview;
