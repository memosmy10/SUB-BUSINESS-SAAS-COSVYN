
import { GoogleGenAI } from "@google/genai";
import { ChartDataPoint } from "../types";

// Safe environment variable access
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    console.error("Error accessing env vars", e);
  }
  return undefined;
};

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const generateBusinessInsights = async (data: ChartDataPoint[]): Promise<string> => {
  try {
    const dataString = JSON.stringify(data);
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      Analyze the following monthly revenue (value) vs expenses (secondaryValue) data for a subscription business.
      Data: ${dataString}
      
      Provide a concise 3-bullet point summary of the financial health and 1 strategic recommendation.
      Keep it professional and brief.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Error generating insights:", error);
    return "Error connecting to AI service. Please check your API key configuration.";
  }
};

export const generateSupportReply = async (customerQuery: string): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      You are a helpful customer support agent for 'SubFlow', a SaaS platform.
      Draft a polite, empathetic, and concise reply to the following customer query.
      
      Customer Query: "${customerQuery}"
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating reply:", error);
    return "Error connecting to AI support assistant.";
  }
};
