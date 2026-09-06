import { verifyUser } from "../_lib/verifyUser.js";
import { callGroq } from "../_lib/groq.js";
import { applyCors } from "../_lib/cors.js";
import { logAndFail } from "../_lib/errors.js";
import { BRAND_RULES } from "../_lib/brand.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return; // handles the OPTIONS preflight
  if (req.method !== "POST") return res.status(405).end();

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { topic } = req.body;
  const prompt = `A user wants to build a survey about: "${topic}" (this may be a single line, or a full conversation transcript — read whatever is there).

Before drafting the survey, decide what you genuinely still need to know about THIS specific project to design a good survey — not a generic checklist. Re-read what's already there first: if the topic/transcript already makes the goal, audience, and what "useful data" means clear, you don't need to ask anything.

Rules:
- Ask ONLY about things that are still genuinely ambiguous or missing for drafting a good survey on THIS project — never a stock set of questions (e.g. "how do you currently handle this / who's involved / urgency / success looks like") that could apply to any topic. Every question must reference specifics from what was actually said.
- Never ask about something already stated or clearly implied in the topic/transcript.
- If everything you need is already clear, return an empty array — do not invent filler questions just to have some.
- Otherwise, ask as few questions as it actually takes to fill the real gaps — usually 1-4, occasionally more for a genuinely underspecified request. Don't pad to hit a round number.
- Each question needs 4-5 realistic, specific options grounded in the project (not generic placeholders like "Yes/No/Maybe").

${BRAND_RULES}

Respond with ONLY a JSON object of this shape:
{"questions": [{"text": string, "options": string[]}, ...]} — as many items as are genuinely needed, including zero.`;

  try {
    const result = await callGroq({
      task: "reasoning",
      prompt,
      systemInstruction: "You always respond with a single valid JSON object and nothing else — no markdown fences, no commentary outside the JSON.",
    });

    const questions = Array.isArray(result.questions) ? result.questions : [];
    const withIds = questions.map((q, i) => ({ id: `q${i + 1}`, text: q.text, options: q.options || [] }));
    return res.status(200).json({ questions: withIds });
  } catch (err) {
    return logAndFail(res, 500, "ai/generate-planning-questions", err, "Couldn't put together planning questions. Please try again.");
  }
}