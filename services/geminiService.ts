
import { GoogleGenAI } from "@google/genai";
import { CardType, OutputFormat, ExtractionMethod } from "../App";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getFormatInstructions = (outputFormat: OutputFormat, cardType: CardType): string => {
    const examples = {
        basic: {
            front: `What causes <b>Community-Acquired Pneumonia</b>?`,
            back: `Common pathogens:<ul><li><i>Streptococcus pneumoniae</i></li><li>Haemophilus influenzae</li><li>Mycoplasma pneumoniae</li></ul>`
        },
        mcq: {
            front: `Which organism causes <i>most</i> UTIs?`,
            back: `A) E. coli ✓<br>B) S. aureus<br>C) Pseudomonas<br>D) Klebsiella`
        },
        cloze: {
            front: `{{c1::<b>Streptococcus pneumoniae</b>}} is the most common cause of community-acquired pneumonia.`,
            back: `<b>Streptococcus pneumoniae</b> is the most common cause of community-acquired pneumonia.`
        }
    }
    const { front: frontExample, back: backExample } = examples[cardType];
    const formattingInstruction = `Use standard HTML tags (e.g., <b>, <i>, <ul>, <li>, <br>) to preserve formatting like bolding, italics, and lists from the original text.`;

  switch (outputFormat) {
    case 'csv':
      return `**FORMAT:** Use Comma-Separated Values (CSV) format with exactly 2 columns. Do not include a header row. Each line must be a single card with the front and back enclosed in double quotes and separated by a comma. Properly escape any double quotes within the content by doubling them. ${formattingInstruction}
      
      **EXAMPLE OF DESIRED FORMAT:**
      
      "${frontExample.replace(/"/g, '""')}","${backExample.replace(/"/g, '""')}"`;
    case 'json':
      return `**FORMAT:** Use JSON format. The output MUST be a valid JSON array of objects. Each object in the array should represent a single flashcard and have two keys: "front" and "back". Do not include any other text or formatting outside the JSON array. The "front" and "back" values should be strings. ${formattingInstruction}

      **EXAMPLE OF DESIRED FORMAT:**
      
      [
        {
          "front": "${frontExample.replace(/"/g, '\\"')}",
          "back": "${backExample.replace(/"/g, '\\"')}"
        }
      ]`;
    case 'tsv':
    default:
      return `**FORMAT:** Use Tab-Separated Values (TSV) format with exactly 2 columns. Do not include a header row like "Front\\tBack". Each line must be a single card with the front and back separated by a single tab character ('\\t'). ${formattingInstruction}

      **EXAMPLE OF DESIRED FORMAT:**
      
      ${frontExample}\t${backExample}`;
  }
};

const getCardTypeInstructions = (cardType: CardType): string => {
    switch (cardType) {
        case 'mcq':
            return `
**Instructions for "Multiple Choice":**
*   For the 'Front', create a clear, answerable question based on the input text.
*   For the 'Back', provide multiple distinct answer options (e.g., A, B, C, D).
*   Ensure one option is clearly the correct answer and is derived from the text.
*   Mark the correct answer by appending a checkmark (✓) to it.
`;
        case 'cloze':
            return `
**Instructions for "Cloze Deletion":**
*   For the 'Front', take a key sentence from the text and hide a critical term or phrase using the Anki cloze format: \`{{c1::hidden text}}\`.
*   Create only one cloze (c1) per card.
*   The 'Back' should contain the full, unedited sentence for context.
*   Focus on hiding the most important piece of information in the sentence.
`;
        case 'basic':
        default:
            return `
**Instructions for "Basic Q&A":**
*   'Front' should be a clear, focused question.
*   'Back' should be a comprehensive but concise answer.
`;
    }
}

const createPromptParts = (userInput: string, options: GenerationOptions): { systemInstruction: string, userContent: string } => {
    const { outputFormat, cardType, numberOfCards, extractionMethod, questionList } = options;
    const systemInstruction = `You are an expert Anki flashcard creator. Your task is to convert the provided text into a structured data format for flashcards. You must adhere strictly to the format and card type instructions. The output MUST BE ONLY the requested data format. Do not add any introductory text, explanations, summaries, or code block formatting like \`\`\` ... \`\`\`. The entire response should be parsable as a raw file of the specified format.`;

    const quantityInstruction = parseInt(numberOfCards, 10) > 0
        ? `Generate exactly ${parseInt(numberOfCards, 10)} flashcards.`
        : `Generate an appropriate number of flashcards based on the length and density of the input text.`;

    let taskInstruction: string;
    let mainInputBlock: string;

    if (extractionMethod === 'user_questions' && questionList) {
        taskInstruction = `
**TASK:** Your task is to act as a research assistant. You have been given a **CONTEXT DOCUMENT** and a **LIST OF QUESTIONS**. For each question in the list, you must find the answer within the context document.

Create one flashcard for each question.
- The 'Front' of the card MUST be the question from the list, exactly as written.
- The 'Back' of the card MUST contain the complete, unabridged answer derived *exclusively* from the **CONTEXT DOCUMENT**. You must extract the entire relevant passage or section that answers the question. DO NOT summarize, shorten, or omit any information from the source text. You can reformat the text using HTML for better readability (like lists or bolding), but the core information must be fully preserved.

If the answer to a specific question cannot be found in the context document, the 'Back' of the card for that question should be exactly: "Answer not found in the provided text."

Finally, format all the generated flashcards according to the specifications below.`;

        mainInputBlock = `
**CONTEXT DOCUMENT:**
---
${userInput}
---

**LIST OF QUESTIONS:**
---
${questionList}
---
`;
    } else if (extractionMethod === 'ai') {
        taskInstruction = `
**TASK:** Your primary task is to act as an expert educator. First, thoroughly analyze the **INPUT TEXT** to identify the most important concepts, facts, and relationships. Based on your analysis, generate a series of insightful questions that cover these key areas.

Once you have formulated the questions, create one flashcard for each question. The 'Front' of the card should be the question you generated. The 'Back' of the card must be a concise, accurate answer derived *exclusively* from the information present in the **INPUT TEXT**.

Finally, format all the generated flashcards according to the specifications below.`;
        
        mainInputBlock = `
**INPUT TEXT:**
---
${userInput}
---
`;
    } else {
        taskInstruction = `
**TASK:** Convert the input text into flashcards with the following specifications.`;

        mainInputBlock = `
**INPUT TEXT:**
---
${userInput}
---
`;
    }

    const userContent = `
${mainInputBlock}

${taskInstruction}

**SPECIFICATIONS:**

1.  **OUTPUT FORMAT DETAILS:**
    ${getFormatInstructions(outputFormat, cardType)}

2.  **CARD TYPE DETAILS:**
    ${getCardTypeInstructions(cardType)}

3.  **QUANTITY:** ${quantityInstruction}

4.  **CONTENT RULES:**
    *   **FORMATTING:** Retain original text formatting (bold, italics, lists) using HTML tags (e.g., <b>, <i>, <ul>, <li>). This is crucial for Anki compatibility.
    *   Create 1 card per key concept/fact unless a specific quantity is requested.
    *   Keep questions/prompts clear and focused.
    *   Answers should be comprehensive but concise.
    *   Prioritize high-yield information for exams or study.
    *   Use simple language without sacrificing accuracy.
    *   **PRESERVE EXISTING QUESTIONS:** If the input text already contains full questions, use them verbatim for the 'Front' of the flashcard. Your main task is to generate the corresponding answer for the 'Back' from the provided text. Do not change the original questions.

**START CONVERSION NOW. Your entire response must be the raw data in the specified format, with no extra text.**
`;
    return { systemInstruction, userContent };
}


interface GenerationOptions {
  model: string;
  outputFormat: OutputFormat;
  cardType: CardType;
  numberOfCards: string;
  extractionMethod: ExtractionMethod;
  questionList?: string;
}

export async function* generateFlashcardsStream(userInput: string, options: GenerationOptions): AsyncGenerator<string> {
  try {
    const { systemInstruction, userContent } = createPromptParts(userInput, options);
    
    const model = options.model;
    const config = {
        systemInstruction,
        ...(model === 'gemini-2.5-pro' ? { thinkingConfig: { thinkingBudget: 32768 } } : {}),
    }

    const responseStream = await ai.models.generateContentStream({
      model,
      contents: userContent,
      config,
    });

    for await (const chunk of responseStream) {
        if (chunk.text) {
            yield chunk.text;
        }
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    let message = "An unexpected error occurred.";
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            message = "API_KEY_INVALID";
        } else if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit')) {
            message = "RATE_LIMIT_EXCEEDED";
        } else if (error.message.includes('candidate') && error.message.includes('was blocked')) {
            message = "CONTENT_BLOCKED";
        }
    }
    throw new Error(message);
  }
};
