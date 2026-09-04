import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function summarizeIncident(description: string, severity: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a senior election security analyst. Please provide a brief, professional summary and potential action plan for the following incident report. 
    Report Description: "${description}"
    Severity Level: ${severity}
    
    Format the response as two short sections:
    1. SUMMARY
    2. RECOMMENDED ACTION
    
    Keep it concise and professional.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI generation failed. Please review manually.";
  }
}
