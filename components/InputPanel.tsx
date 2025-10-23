
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { GenerateIcon, InfoIcon, UploadIcon } from './icons';
import { CardType, OutputFormat, ExtractionMethod } from '../App';

// Custom hook for debouncing a value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the specified delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if the value or delay changes before the timer fires
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface InputPanelProps {
  inputText: string;
  setInputText: (text: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  model: string;
  setModel: (value: string) => void;
  cardType: CardType;
  setCardType: (value: CardType) => void;
  outputFormat: OutputFormat;
  setOutputFormat: (value: OutputFormat) => void;
  numberOfCards: string;
  setNumberOfCards: (value: string) => void;
  extractionMethod: ExtractionMethod;
  setExtractionMethod: (value: ExtractionMethod) => void;
  regexPattern: string;
  setRegexPattern: (value: string) => void;
  regexFlags: string;
  setRegexFlags: (value: string) => void;
  questionList: string;
  setQuestionList: (value: string) => void;
}

const presets = {
  custom: { pattern: '', flags: 'g', label: 'Custom' },
  qa_pairs: { pattern: '^\\*\\*Question:\\*\\*.*\\n^\\*\\*Answer:\\*\\*.*', flags: 'gm', label: 'Q&A Pairs (**Question:**/**Answer:**)' },
  q_lines: { pattern: '^Q:.*', flags: 'gm', label: 'Lines starting with "Q:"' },
  brackets: { pattern: '\\[\\[(.*?)\\]\\]', flags: 'g', label: 'Text inside [[brackets]]' },
  bold: { pattern: '\\*\\*(.*?)\\*\\*', flags: 'g', label: 'Text in **bold**' },
};

export const InputPanel: React.FC<InputPanelProps> = ({ 
  inputText, 
  setInputText, 
  onGenerate, 
  isLoading,
  model,
  setModel,
  cardType,
  setCardType,
  outputFormat,
  setOutputFormat,
  numberOfCards,
  setNumberOfCards,
  extractionMethod,
  setExtractionMethod,
  regexPattern,
  setRegexPattern,
  regexFlags,
  setRegexFlags,
  questionList,
  setQuestionList,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof presets>('custom');
  
  // Debounce the inputs for the expensive highlighting calculation to improve performance.
  const debouncedInputText = useDebounce(inputText, 250);
  const debouncedRegexPattern = useDebounce(regexPattern, 250);
  const debouncedRegexFlags = useDebounce(regexFlags, 250);

  const { highlightedContent, matchCount, error: regexError } = useMemo(() => {
    if (extractionMethod !== 'regex' || !debouncedInputText || !debouncedRegexPattern.trim()) {
      return { highlightedContent: <>{debouncedInputText}</>, matchCount: 0, error: null };
    }

    try {
      // Ensure 'd' flag for indices and 'g' for matchAll
      const flags = [...new Set((debouncedRegexFlags || '') + 'dg')].join('');
      const regex = new RegExp(debouncedRegexPattern, flags);

      const matches = Array.from(debouncedInputText.matchAll(regex)) as (RegExpMatchArray & { indices?: [number, number][] })[];
      
      if (matches.length === 0) {
        return { highlightedContent: <>{debouncedInputText}</>, matchCount: 0, error: "No matches found." };
      }

      let lastIndex = 0;
      const parts: (string | React.ReactElement)[] = [];

      matches.forEach((match, i) => {
        const indices = (match.indices && match.indices.length > 1 && match.indices[1]) 
          ? match.indices[1]
          : match.indices?.[0];
        
        if (!indices) { // Fallback for browsers without 'd' flag support.
          const fullMatch = match[0];
          const textToHighlight = match[1] ?? fullMatch;
          const start = debouncedInputText.indexOf(textToHighlight, match.index);
          if (start === -1) return;
          const end = start + textToHighlight.length;
           if (start > lastIndex) parts.push(debouncedInputText.substring(lastIndex, start));
           parts.push(<span key={i} className="bg-brand-primary/40 rounded-sm">{debouncedInputText.substring(start, end)}</span>);
           lastIndex = end;
          return;
        }
        
        const [start, end] = indices;
        if (start > lastIndex) {
          parts.push(debouncedInputText.substring(lastIndex, start));
        }
        parts.push(<span key={i} className="bg-brand-primary/40 rounded-sm">{debouncedInputText.substring(start, end)}</span>);
        lastIndex = end;
      });

      if (lastIndex < debouncedInputText.length) {
        parts.push(debouncedInputText.substring(lastIndex));
      }

      return { highlightedContent: <>{parts}</>, matchCount: matches.length, error: null };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Invalid Regular Expression';
      return { highlightedContent: <>{debouncedInputText}</>, matchCount: 0, error: errorMessage };
    }
  }, [extractionMethod, debouncedInputText, debouncedRegexPattern, debouncedRegexFlags]);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileError(null);
    if (file.type !== 'text/plain') {
      setFileError('Invalid file type. Please upload a .txt file.');
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setFileError('File is too large. Please upload files under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setInputText(e.target?.result as string);
    reader.onerror = () => setFileError('Error reading file. Please try again.');
    reader.readAsText(file);
    event.target.value = '';
  };

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const presetKey = event.target.value as keyof typeof presets;
    setSelectedPreset(presetKey);
    const preset = presets[presetKey];
    if (presetKey !== 'custom') {
      setRegexPattern(preset.pattern);
      setRegexFlags(preset.flags);
    }
  };

  const handlePatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegexPattern(e.target.value);
    setSelectedPreset('custom');
  };

  const handleFlagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegexFlags(e.target.value);
    setSelectedPreset('custom');
  };

  const commonEditorClasses = "absolute inset-0 w-full h-full p-3 rounded-md resize-none font-mono text-base leading-relaxed whitespace-pre-wrap break-words overflow-auto";

  return (
    <div className="flex-1 flex flex-col bg-gray-800 rounded-lg shadow-lg p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-300">Step 1: Add Your Notes</h2>
        <button
          onClick={handleFileUploadClick}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-gray-700 text-sm py-1.5 px-3 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Upload a text file"
        >
          <UploadIcon />
          Upload File
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt" className="hidden" aria-hidden="true" />
      </div>
      {fileError && <p className="text-red-400 text-xs mb-2 -mt-1">{fileError}</p>}
      
      <div className="relative flex-grow w-full">
        <div
          ref={backdropRef}
          aria-hidden="true"
          className={`${commonEditorClasses} bg-gray-900 border border-gray-700 text-white pointer-events-none`}
        >
          {highlightedContent}
        </div>
        <textarea
          ref={textareaRef}
          className={`${commonEditorClasses} bg-transparent border-transparent text-transparent caret-white z-10 focus:outline-none focus:ring-2 focus:ring-brand-primary`}
          placeholder="Paste your text or PDF content here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onScroll={handleScroll}
          disabled={isLoading}
          spellCheck="false"
          aria-label="Input for notes to be converted"
        />
      </div>

      <details className="group mt-4 border border-gray-700 rounded-lg bg-gray-900/50" open>
        <summary className="text-lg font-semibold text-gray-300 cursor-pointer list-none flex justify-between items-center p-4">
            <span>Step 2: Configuration</span>
            <span className="transition-transform duration-300 group-open:rotate-180">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
        </summary>
        <div className="grid grid-rows-[0fr] group-open:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
            <div className="overflow-hidden">
                <div className="p-4 pt-0 space-y-6">
                  {/* --- PRIMARY SETTINGS --- */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Card Type</label>
                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-700 p-1">
                        {(['basic', 'mcq', 'cloze'] as const).map((type) => {
                          const typeLabels: Record<CardType, string> = { basic: 'Basic Q&A', mcq: 'Multiple Choice', cloze: 'Cloze' };
                          return (
                            <div key={type}>
                              <input type="radio" id={`card-type-${type}`} name="card-type" value={type} checked={cardType === type} onChange={() => setCardType(type)} disabled={isLoading} className="sr-only" />
                              <label htmlFor={`card-type-${type}`} className={`block w-full text-center text-sm font-medium rounded-md py-2 cursor-pointer transition-colors duration-200 ${cardType === type ? 'bg-brand-primary text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}>
                                {typeLabels[type]}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Text Extraction</label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-lg bg-gray-700 p-1">
                        {(['none', 'auto', 'regex', 'ai', 'user_questions'] as const).map((method) => {
                          const methodLabels: Record<ExtractionMethod, string> = { none: 'All Text', auto: 'Auto-detect', regex: 'Custom', ai: 'AI Questions', user_questions: 'My Questions' };
                          return (
                            <div key={method}>
                              <input type="radio" id={`extract-method-${method}`} name="extract-method" value={method} checked={extractionMethod === method} onChange={() => setExtractionMethod(method)} disabled={isLoading} className="sr-only" />
                              <label htmlFor={`extract-method-${method}`} className={`block w-full text-center text-sm font-medium rounded-md py-2 px-1 cursor-pointer transition-colors duration-200 ${extractionMethod === method ? 'bg-brand-primary text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}>
                                {methodLabels[method]}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* --- CONDITIONAL CONTEXTUAL UI --- */}
                  {extractionMethod === 'user_questions' && (
                    <div className="space-y-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <label htmlFor="question-list" className="block text-sm font-medium text-gray-300">
                        Your List of Questions
                      </label>
                      <textarea
                        id="question-list"
                        className="w-full h-32 p-2 bg-gray-700 border border-gray-600 rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        placeholder="Paste your questions here, one per line..."
                        value={questionList}
                        onChange={(e) => setQuestionList(e.target.value)}
                        disabled={isLoading}
                        aria-label="Paste your list of questions"
                      />
                      <p className="text-xs text-gray-400">
                        The AI will answer these questions using the notes you provided in Step 1.
                      </p>
                    </div>
                  )}
                  {extractionMethod === 'ai' && (
                      <div className="text-xs text-gray-400 p-2 bg-gray-800 rounded-md">
                          The AI will read your entire text, automatically generate relevant questions about the key concepts, and then create flashcards with answers found in the text.
                      </div>
                  )}
                  {extractionMethod === 'auto' && (
                      <div className="text-xs text-gray-400 p-2 bg-gray-800 rounded-md">
                          Automatically finds blocks of text to treat as individual cards. It looks for lines starting with:
                          <ul className="list-disc list-inside ml-2 mt-1">
                              <li><code className="font-mono text-xs bg-gray-700 p-0.5 rounded">Q:</code> or <code className="font-mono text-xs bg-gray-700 p-0.5 rounded">Question:</code></li>
                              <li><code className="font-mono text-xs bg-gray-700 p-0.5 rounded">- </code> (hyphen + space)</li>
                              <li><code className="font-mono text-xs bg-gray-700 p-0.5 rounded">* </code> (asterisk + space)</li>
                          </ul>
                      </div>
                  )}
                  {extractionMethod === 'regex' && (
                    <div className="space-y-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <div>
                        <label htmlFor="regex-preset" className="block text-sm font-medium text-gray-300 mb-1.5">Regex Presets</label>
                        <select id="regex-preset" value={selectedPreset} onChange={handlePresetChange} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block p-2.5" aria-label="Select a Regex preset">
                          {Object.entries(presets).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="regex-pattern" className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1.5">
                          Regex Pattern
                          <div className="group relative">
                            <InfoIcon />
                            <div className="absolute bottom-full mb-2 w-72 p-2 text-xs text-white bg-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                              Extracts matching text. Highlights show what will be extracted. Use a capture group `()` to extract a specific part of a match. Example: `Q: (.*)` extracts just the question.
                            </div>
                          </div>
                        </label>
                        <div className="flex gap-2">
                            <input type="text" id="regex-pattern" value={regexPattern} onChange={handlePatternChange} disabled={isLoading} className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block p-2.5 font-mono" placeholder="e.g., ^Q:.*" aria-label="Enter a regular expression pattern" />
                            <input type="text" id="regex-flags" value={regexFlags} onChange={handleFlagsChange} disabled={isLoading} className="w-20 bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block p-2.5 font-mono" placeholder="Flags" aria-label="Enter regular expression flags" />
                        </div>
                        <div className="mt-1.5 text-xs h-4">
                          {regexError ? (
                            <span className={regexError === 'No matches found.' ? 'text-gray-400' : 'text-red-400'}>{regexError}</span>
                          ) : regexPattern.trim() && matchCount > 0 ? (
                            <span className="text-green-400">{matchCount} {matchCount === 1 ? 'match' : 'matches'} found</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- SECONDARY SETTINGS --- */}
                  <div className="pt-6 border-t border-gray-700">
                    <h3 className="text-base font-semibold text-gray-300 mb-4">Output & AI Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="ai-model" className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1.5">
                          AI Model
                          <div className="group relative">
                            <InfoIcon />
                            <div className="absolute bottom-full mb-2 w-64 p-2 text-xs text-white bg-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                              Flash is faster for simple tasks. Pro is better for complex topics but may take longer.
                            </div>
                          </div>
                        </label>
                        <select id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block p-2.5" aria-label="Select AI model">
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="output-format" className="block text-sm font-medium text-gray-300 mb-1.5">Output Format</label>
                        <select id="output-format" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block p-2.5" aria-label="Select output format">
                          <option value="tsv">TSV (.txt) - Best for Anki</option>
                          <option value="csv">CSV (.csv) - Comma Separated</option>
                          <option value="json">JSON (.json) - For developers</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="number-of-cards" className="block text-sm font-medium text-gray-300 mb-1.5"># of Cards (Optional)</label>
                        <input type="number" id="number-of-cards" value={numberOfCards} onChange={(e) => setNumberOfCards(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block p-2.5" placeholder="Auto" min="1" aria-label="Enter the number of flashcards to generate" />
                      </div>
                    </div>
                  </div>
                </div>
            </div>
        </div>
      </details>

      <button
        onClick={onGenerate}
        disabled={isLoading || !inputText.trim()}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-2.5 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:bg-brand-secondary disabled:cursor-not-allowed transition-all duration-300"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Generating...</span>
          </>
        ) : (
          <>
            <GenerateIcon />
            <span>Generate Flashcards</span>
          </>
        )}
      </button>
    </div>
  );
};
