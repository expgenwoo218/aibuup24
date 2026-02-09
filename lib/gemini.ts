
import { GoogleGenAI } from "@google/genai";

export const generateAIReport = async (prompt: string, systemInstruction: string) => {
  try {
    // Correct initialization as per @google/genai coding guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });
    // Correct property access (not a method call)
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
