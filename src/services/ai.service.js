import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Gemini integration
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;
const HF_MODEL = process.env.HF_MODEL_NAME || 'facebook/bart-large-mnli';
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// Gemini setup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let geminiModel = null;
if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

async function callHuggingFaceAPI(inputs, candidateLabels = ['true', 'false', 'misleading']) {
  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      parameters: { candidate_labels: candidateLabels },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`[HuggingFace] ${response.statusText}: ${error}`);
  }

  return await response.json();
}

async function analyzeClaim(claimText) {
  try {
    const result = await callHuggingFaceAPI(claimText, ['true', 'false', 'misleading']);
    const top = result.labels[0];
    const confidence = (result.scores[0] * 100).toFixed(1);
    return `This claim is likely **${top}** (confidence: ${confidence}%).`;
  } catch (err) {
    console.error('[AIService] analyzeClaim error:', err.message);
    return 'No AI analysis available.';
  }
}

async function categorizeClaim(claimText) {
  try {
    const categories = ['politics', 'health', 'technology', 'conspiracy', 'religion', 'science'];
    const result = await callHuggingFaceAPI(claimText, categories);
    const top = result.labels[0];
    const confidence = (result.scores[0] * 100).toFixed(1);
    return {
      message: `Categorized as: ${top} (confidence: ${confidence}%)`,
      categories: [top],
    };
  } catch (err) {
    console.error('[AIService] categorizeClaim error:', err.message);
    return {
      message: 'No categorization available.',
      categories: [],
    };
  }
}

/**
 * Summarizes a list of fact-check results from the Google API using Gemini.
 * @param {Array} claims - The array of claim objects from the fact-check API.
 * @returns {Object} A structured summary with overview, consensus, and conclusion.
 */
async function generateSummary(claims) {
  // Gracefully handle the case where no results are found
  if (!claims || claims.length === 0) {
    return {
      overview: "No existing fact-checks were found for this claim.",
      consensus: "Insufficient Data",
      conclusion: "Further investigation is required as no prior art was found."
    };
  }

  if (!geminiModel) {
    return {
      overview: "Gemini API key not set or Gemini model not initialized.",
      consensus: "Error",
      conclusion: "Could not generate summary due to missing Gemini configuration."
    };
  }

  const prompt = `
You are a senior fact-check analyst. Your task is to synthesize the findings from a list of fact-checks provided in a raw JSON format. The JSON contains an array of claims reviewed by various publishers.

Based ONLY on the data within the following JSON, provide a summary.

JSON DATA:
\n\n\`\`\`json\n${JSON.stringify(claims, null, 2)}\n\`\`\`

Please structure your response in a strict JSON format with three keys: "overview", "consensus", and "conclusion".

1.  **overview**: (String) Write a neutral, 2-3 sentence paragraph summarizing the general findings. Mention the range of verdicts (e.g., "True", "Misleading", "False") if there's a mix.
2.  **consensus**: (String) Analyze the verdicts and state the level of agreement. Choose ONE of the following options: "Strong Consensus", "General Consensus", "Mixed Findings", "Contradictory".
3.  **conclusion**: (String) Provide a final, one-sentence takeaway that best represents the collective weight of the provided fact-checks.
`;

  try {
    const result = await geminiModel.generateContent(prompt);
    const responseText = result.response.text();
    // Clean up the response to ensure it's valid JSON
    const cleanJsonString = responseText.replace(/```json\n|\n```/g, '').trim();
    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error("[AIService] Error generating AI summary with Gemini:", error);
    // Return a fallback object in case of an AI error
    return {
      overview: "An error occurred while generating the AI summary.",
      consensus: "Error",
      conclusion: "Could not determine a conclusion due to an internal error."
    };
  }
}

export default {
  analyzeClaim,
  categorizeClaim,
  generateSummary,
};
