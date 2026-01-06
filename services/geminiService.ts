import { GoogleGenAI } from "@google/genai";
import { ChartDataPoint } from "../types";

// Initialize Gemini with the strictly required named parameter pattern
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBusinessInsights = async (data: ChartDataPoint[]): Promise<string> => {
  try {
    if (!data || data.length === 0) return "Not enough data to generate insights yet.";
    
    // Filtering out months with no data to save tokens and improve accuracy
    const activeData = data.filter(d => (d.value || 0) > 0 || (d.secondaryValue || 0) > 0);
    const dataString = JSON.stringify(activeData);
    
    // Using gemini-3-flash-preview for fast, low-latency text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following monthly revenue (value) vs expenses (secondaryValue) data for a meal subscription business.
      Data: ${dataString}
      
      Provide a concise 3-bullet point summary of the financial health and 1 strategic recommendation for the kitchen owner.
      Keep it professional, encouraging, and brief. Use Lakhs/Rupees context.`
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "AI insights are currently warming up. Check back in a moment!";
  }
};

export const generateSupportReply = async (customerQuery: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a helpful customer support agent for 'ScaleKitchen', a SaaS platform for tiffin services.
      Draft a polite, empathetic, and concise reply to the following kitchen owner query: "${customerQuery}"`
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini Support Error:", error);
    return "Error connecting to AI support assistant.";
  }
};