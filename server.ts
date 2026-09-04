import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Lazy initialization of Gemini API Client to prevent startup failure if key is unset
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not configured.");
      }
      aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
  }

  // Server-side AI Summarization endpoint using @google/genai
  app.post("/api/gemini/summarize", async (req, res) => {
    try {
      const { description, severity } = req.body;
      if (!description || typeof description !== "string") {
        return res.status(400).json({ error: "A valid incident description is required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: "GEMINI_API_KEY is not configured.",
          fallbackText: "AI incident analysis is unavailable because GEMINI_API_KEY is not set. Please review manually.",
        });
      }

      const ai = getGeminiClient();
      const prompt = `You are a senior election security analyst. Please provide a brief, professional summary and potential action plan for the following incident report.
Report Description: "${description.trim()}"
Severity Level: ${severity || "normal"}

Format the response as two short sections:
1. SUMMARY
2. RECOMMENDED ACTION

Keep it concise and professional.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const outputText = response.text || "AI analysis completed with no summary text.";
      return res.json({ text: outputText });
    } catch (error: any) {
      console.error("Gemini summarization error:", error);
      return res.status(500).json({
        error: error?.message || "Failed to generate AI summary.",
        fallbackText: "AI generation failed. Please review manually.",
      });
    }
  });

  // Vite development middleware vs production static distribution
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`iVote server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
