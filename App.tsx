import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { InputPanel } from './components/InputPanel';
import { OutputPanel } from './components/OutputPanel';
import { generateFlashcardsStream } from './services/geminiService';

export type OutputFormat = 'tsv' | 'csv' | 'json';
export type CardType = 'basic' | 'mcq' | 'cloze';
export type ExtractionMethod = 'none' | 'auto' | 'regex' | 'ai' | 'user_questions';

function App() {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [cardType, setCardType] = useState<CardType>('basic');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('tsv');
  const [numberOfCards, setNumberOfCards] = useState<string>('');
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMethod>('none');
  const [regexPattern, setRegexPattern] = useState<string>('');
  const [regexFlags, setRegexFlags] = useState<string>('g');
  const [questionList, setQuestionList] = useState<string>('');


  const getFriendlyErrorMessage = (errorMessage: string): string => {
    switch (errorMessage) {
        case 'API_KEY_INVALID':
            return "API Key Error: The provided API key is invalid. Please ensure it's correct and has the necessary permissions.";
        case 'RATE_LIMIT_EXCEEDED':
            return "Rate Limit Exceeded: You've made too many requests in a short period. Please wait a moment before trying again.";
        case 'CONTENT_BLOCKED':
            return "Content Safety Error: The request was blocked due to safety settings. Please modify your input text and try again.";
        default:
            return "An unexpected error occurred. Please check your network connection or try again later.";
    }
  }

  const handleGenerate = useCallback(async () => {
    if (!navigator.onLine) {
        setError("You appear to be offline. An internet connection is required to generate flashcards.");
        return;
    }
    
    if (!inputText.trim()) {
      setError('Please enter some text to generate flashcards.');
      return;
    }
    
    setError(null);
    let processedInput = inputText;

    if (extractionMethod === 'auto') {
        try {
            // This regex splits the text at the beginning of lines that start with the specified markers,
            // using a positive lookahead `(?=...)` to keep the markers in the resulting chunks.
            // The `m` flag is crucial for `^` to match the start of each line.
            const matches = inputText.split(/(?=^Q:|^Question:|^[-*] )/m).filter(s => s.trim() !== '');

            if (matches.length > 0) {
                processedInput = matches.join('\n\n');
            } else {
                setError('Auto-detect mode is on, but no lines starting with "Q:", "Question:", "- ", or "* " were found. Processing all text.');
                // We don't return here; we allow it to proceed with the full text as a fallback.
            }
        } catch (e) {
            setError('An error occurred during automatic Q&A detection.');
            console.error(e);
            return;
        }
    } else if (extractionMethod === 'regex' && regexPattern.trim()) {
        try {
            const regex = new RegExp(regexPattern, regexFlags);
            const matches = Array.from(inputText.matchAll(regex));

            if (matches.length > 0) {
                processedInput = matches.map(match => match[1] ?? match[0]).join('\n\n');
            } else {
                setError('No matches found for the provided regular expression.');
                return;
            }
        } catch (e) {
            setError('Invalid regular expression pattern or flags.');
            console.error(e);
            return;
        }
    } else if (extractionMethod === 'user_questions' && !questionList.trim()) {
      setError('Please enter a list of questions for the AI to answer.');
      return;
    }

    if (!processedInput.trim()) {
      setError('The text after applying the extraction method is empty.');
      return;
    }

    setIsLoading(true);
    setOutputText('');

    try {
      const stream = generateFlashcardsStream(processedInput, { model, outputFormat, cardType, numberOfCards, extractionMethod, questionList });
      for await (const chunk of stream) {
        setOutputText((prev) => prev + chunk);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(getFriendlyErrorMessage(errorMessage));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, model, outputFormat, cardType, numberOfCards, extractionMethod, regexPattern, regexFlags, questionList]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="flex-grow flex flex-col md:flex-row gap-4 p-4 overflow-hidden">
        <InputPanel 
          inputText={inputText} 
          setInputText={setInputText} 
          onGenerate={handleGenerate} 
          isLoading={isLoading}
          model={model}
          setModel={setModel}
          cardType={cardType}
          setCardType={setCardType}
          outputFormat={outputFormat}
          setOutputFormat={setOutputFormat}
          numberOfCards={numberOfCards}
          setNumberOfCards={setNumberOfCards}
          extractionMethod={extractionMethod}
          setExtractionMethod={setExtractionMethod}
          regexPattern={regexPattern}
          setRegexPattern={setRegexPattern}
          regexFlags={regexFlags}
          setRegexFlags={setRegexFlags}
          questionList={questionList}
          setQuestionList={setQuestionList}
        />
        <OutputPanel 
          outputText={outputText} 
          isLoading={isLoading} 
          error={error} 
          outputFormat={outputFormat}
        />
      </main>
      <footer className="text-center p-2 text-xs text-gray-500">
        <p>Generated content may require review for accuracy. Always verify important information.</p>
      </footer>
    </div>
  );
}

export default App;
