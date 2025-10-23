
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-800 shadow-md p-4">
      <h1 className="text-xl md:text-2xl font-bold text-center text-brand-primary tracking-wide">
        AI Anki Flashcard Generator
      </h1>
      <p className="text-center text-sm text-gray-400 mt-1">Convert your notes into Anki cards instantly</p>
    </header>
  );
};
