import React, { useState, useEffect, useRef } from 'react';
import { CopyIcon, DownloadIcon, ErrorIcon, CheckCircleIcon, WarningIcon, InvalidIcon } from './icons';

type OutputFormat = 'tsv' | 'csv' | 'json';

interface OutputPanelProps {
  outputText: string;
  isLoading: boolean;
  error: string | null;
  outputFormat: OutputFormat;
}

type ValidationState = {
  status: 'idle' | 'valid' | 'invalid' | 'warning';
  message: string;
};

const ValidationIndicator: React.FC<{ validation: ValidationState }> = ({ validation }) => {
    if (validation.status === 'idle') {
        return null;
    }

    const icons = {
        valid: <CheckCircleIcon />,
        warning: <WarningIcon />,
        invalid: <InvalidIcon />,
    };

    return (
        <div className="group relative flex items-center">
            {icons[validation.status]}
            <div className="absolute bottom-full mb-2 w-60 p-2 text-xs text-white bg-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                {validation.message}
            </div>
        </div>
    );
};

export const OutputPanel: React.FC<OutputPanelProps> = ({ outputText, isLoading, error, outputFormat }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle', message: '' });
  const prevIsLoadingRef = useRef(isLoading);

  useEffect(() => {
    if (copyButtonText === 'Copied!') {
      const timer = setTimeout(() => setCopyButtonText('Copy'), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyButtonText]);

  useEffect(() => {
    // Validate only when generation has just finished
    const justFinishedLoading = prevIsLoadingRef.current === true && isLoading === false;
    
    if (justFinishedLoading && outputText) {
        let result: ValidationState = { status: 'valid', message: 'Format appears valid.' };
        
        switch(outputFormat) {
            case 'json':
                try {
                    JSON.parse(outputText.trim());
                    result = { status: 'valid', message: 'JSON format is valid.' };
                } catch (e) {
                    result = { status: 'invalid', message: 'Invalid JSON detected. The file may be corrupted or incomplete.' };
                }
                break;
            
            case 'csv':
                const csvLines = outputText.trim().split('\n').filter(line => line.trim() !== '');
                if (csvLines.length > 0 && csvLines.some(line => !line.startsWith('"') || !line.endsWith('"') || line.split('","').length !== 2)) {
                    result = { status: 'warning', message: 'Potential CSV formatting issues found. Check for proper quoting and delimiters.' };
                }
                break;
            
            case 'tsv':
                const tsvLines = outputText.trim().split('\n').filter(line => line.trim() !== '');
                if (tsvLines.length > 0 && tsvLines.some(line => line.split('\t').length !== 2)) {
                    result = { status: 'warning', message: 'Potential TSV formatting issues found. Some rows may not have exactly two columns.' };
                }
                break;
        }
        setValidation(result);
    } else if (!outputText || isLoading) {
        // Reset when cleared, on initial load, or when loading starts
        setValidation({ status: 'idle', message: '' });
    }

    // Update the ref at the end of the effect
    prevIsLoadingRef.current = isLoading;

}, [outputText, outputFormat, isLoading]);
  
  const handleCopy = () => {
    if (outputText) {
      navigator.clipboard.writeText(outputText);
      setCopyButtonText('Copied!');
    }
  };

  const handleDownload = () => {
    if (outputText) {
      const extension = { tsv: 'txt', csv: 'csv', json: 'json' }[outputFormat];
      const mimeType = { tsv: 'text/plain', csv: 'text/csv', json: 'application/json' }[outputFormat];
      
      const blob = new Blob([outputText], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anki_flashcards.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const hasOutput = outputText.length > 0;

  const getPlaceholder = () => {
    if (isLoading) return "Generating flashcards, please wait...";
    return `Generated flashcards will appear here in ${outputFormat.toUpperCase()} format...`;
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-800 rounded-lg shadow-lg p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
            Generated Cards ({outputFormat.toUpperCase()})
            <ValidationIndicator validation={validation} />
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!hasOutput || isLoading || !!error}
            className="flex items-center gap-1.5 bg-gray-700 text-sm py-1.5 px-3 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Copy to clipboard"
          >
            <CopyIcon />
            {copyButtonText}
          </button>
          <button
            onClick={handleDownload}
            disabled={!hasOutput || isLoading || !!error}
            className="flex items-center gap-1.5 bg-gray-700 text-sm py-1.5 px-3 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label={`Download as .${{ tsv: 'txt', csv: 'csv', json: 'json' }[outputFormat]}`}
          >
            <DownloadIcon />
            Download
          </button>
        </div>
      </div>
      {error ? (
        <div className="flex-grow w-full p-4 bg-red-900/20 border border-red-500/50 rounded-md flex flex-col items-center justify-center text-center">
            <ErrorIcon />
            <h3 className="mt-2 text-lg font-semibold text-red-400">Generation Failed</h3>
            <p className="mt-1 text-sm text-gray-300">{error}</p>
        </div>
      ) : (
        <textarea
            className="flex-grow w-full p-3 bg-gray-900 border border-gray-700 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary transition duration-200"
            placeholder={getPlaceholder()}
            value={outputText}
            readOnly
            aria-label="Output of generated flashcards"
        />
      )}
    </div>
  );
};
