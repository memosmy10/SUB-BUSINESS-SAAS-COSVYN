import { GoogleGenAI } from "@google/genai";
import { ChartDataPoint } from "../types";

export const generateBusinessInsights = async (data: ChartDataPoint[]): Promise<string> => {
  try {
    // CRITICAL: Initialize a new GoogleGenAI instance right before making an API call.
    // The API key must be obtained directly from process.env.API_KEY.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (!data || data.length === 0) return "Not enough data to generate insights yet.";
    
    // Filtering out months with no data to save tokens and improve accuracy
    const activeData = data.filter(d => (d.value || 0) > 0 || (d.secondaryValue || 0) > 0);
    if (activeData.length === 0) return "Gathering data to provide your first AI insight...";
    
    const dataString = JSON.stringify(activeData);
    
    // For complex reasoning tasks like financial data analysis, use 'gemini-3-pro-preview'.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze the following monthly revenue (value) vs expenses (secondaryValue) data for a meal subscription business.
      Data: ${dataString}
      
      Provide a concise 3-bullet point summary of the financial health and 1 strategic recommendation for the kitchen owner.
      Keep it professional, encouraging, and brief. Use Lakhs/Rupees context.`
    });

    // Directly access the .text property as it returns the string output.
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "AI insights are currently warming up. Check back in a moment!";
  }
};

export const generateSupportReply = async (customerQuery: string): Promise<string> => {
  try {
    // Initialize a new GoogleGenAI instance inside the function.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // For basic text generation tasks, 'gemini-3-flash-preview' is sufficient.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a helpful customer support agent for 'ScaleKitchen', a SaaS platform for tiffin services.
      Draft a polite, empathetic, and concise reply to the following kitchen owner query: "${customerQuery}"`
    });

    // Directly access the .text property.
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini Support Error:", error);
    return "Error connecting to AI support assistant.";
  }
};