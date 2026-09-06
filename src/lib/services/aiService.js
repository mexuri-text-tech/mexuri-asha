// aiService.js — calls our own /api/ai/* routes (which hold the Groq key
// server-side) instead of Groq directly. Same exported function names and
// return shapes as before — only the backing provider changed.
import { supabase } from "../supabaseClient";
import { summarizeSurveyResponses } from "../surveyInsights";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function authedPost(path, body, { signal } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request to ${path} failed (${res.status})`);
  }
  return res.json();
}

export async function sendMessage({ history, userMessage, responseStyle = "casual", referencedSurvey = null, documentContexts = [], mode = "chat", signal }) {
  return authedPost("/api/ai/chat", {
    history,
    userMessage,
    responseStyle,
    mode,
    referencedSurvey: referencedSurvey
      ? {
        title: referencedSurvey.title,
        description: referencedSurvey.description,
        questions: referencedSurvey.questions,
        // Pre-aggregated so the model reasons over real counts instead of
        // raw rows — keeps the request small (and fast) too.
        responseSummary: summarizeSurveyResponses(referencedSurvey),
      }
      : null,
    // Each summary is already the compact text from documentInsights.js —
    // the server just slots them into the prompt.
    documentContexts: documentContexts.map((d) => ({ fileName: d.fileName, type: d.type, summary: d.summary })),
  }, { signal });
}

export async function generateChatTitle(firstMessage) {
  const { title } = await authedPost("/api/ai/generate-title", { firstMessage });
  return title;
}

export async function generateSurvey({ chatContext }) {
  return authedPost("/api/ai/generate-survey", { chatContext });
}

export async function generatePlanningQuestions(topic) {
  const { questions } = await authedPost("/api/ai/generate-planning-questions", { topic });
  return questions;
}