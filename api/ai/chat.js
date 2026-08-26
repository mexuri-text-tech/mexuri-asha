import { verifyUser } from "../_lib/verifyUser.js";
import { callGroq } from "../_lib/groq.js";
import { applyCors } from "../_lib/cors.js";
import { logAndFail } from "../_lib/errors.js";
import { BRAND_RULES } from "../_lib/brand.js";
import { getCached, setCached, normalizeCacheKey } from "../_lib/aiCache.js";

const STYLE_GUIDE = {
  casual: "Friendly, relaxed, conversational. Contractions are fine.",
  corporate: "Formal, structured, professional tone.",
  analytical: "Precise, methodical, data-first framing.",
  concise: "Short, direct, no fluff. Minimal words.",
};

const MAX_TOTAL_DOC_CONTEXT_CHARS = 9000;

function buildDocumentsBlock(documentContexts) {
  const withSummaries = (documentContexts || []).filter((d) => d?.summary);
  if (!withSummaries.length) return "";

  const perFileCap = Math.floor(MAX_TOTAL_DOC_CONTEXT_CHARS / withSummaries.length);
  const fileBlocks = withSummaries.map((d, i) => {
    const summary = d.summary.length > perFileCap ? d.summary.slice(0, perFileCap) + "\n...(truncated to fit)" : d.summary;
    return `--- File ${i + 1}: "${d.fileName}" ---\n${summary}`;
  });

  const intro = withSummaries.length > 1
    ? `The user attached ${withSummaries.length} files to this message. Treat them as one combined context for the reply below — cross-reference and compare across files where it's relevant to what they're asking, and be explicit about which file a number or finding comes from when it matters.`
    : `The user just attached a file. Here's a summary of its contents — use it as context for your reply.`;

  return `\n\n${intro}\n\n${fileBlocks.join("\n\n")}\n\nGround every claim in the actual data above; never invent numbers, rows, or details that aren't there. If the data doesn't answer what the user's asking, say so plainly instead of guessing.`;
}

function isSimpleContextFreeRequest({ history, referencedSurvey, documentContexts }) {
  return history.length === 0 && !referencedSurvey && !(documentContexts || []).some((d) => d?.summary);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { history = [], userMessage, responseStyle = "casual", referencedSurvey = null, documentContexts = [] } = req.body;
  const transcript = history.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
  const simpleContextFree = isSimpleContextFreeRequest({ history, referencedSurvey, documentContexts });

  // Only cache first-turn, context-free requests. This prevents a cached
  // answer from leaking conversation-, survey-, or document-specific data.
  const cacheKey = simpleContextFree
    ? `${responseStyle}:${normalizeCacheKey(userMessage || "")}`
    : null;
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json(cached);
  }

  let referenceBlock = "";
  if (referencedSurvey) {
    const questionLines = (referencedSurvey.questions || [])
      .map((q, i) => `  ${i + 1}. (${q.type}) ${q.text}`)
      .join("\n");

    referenceBlock = `\n\nThe user just referenced one of their surveys with "+". Use it as context for your reply:
Survey title: ${referencedSurvey.title}
Description: ${referencedSurvey.description || "(none)"}
Questions:
${questionLines || "(no questions)"}

Response data:
${referencedSurvey.responseSummary || "No responses have been collected yet."}

If the user is asking about this survey's results, analyze the response data above and give clear, honest insights in simple, plain-English terms — no jargon. Ground every claim in the actual numbers given; never invent findings that aren't supported by the data above. If there isn't enough response data to say anything meaningful yet, say so plainly instead of making something up. Where relevant, follow the insight with a short, concrete piece of strategy or advice on what to do next.`;
  }

  const documentBlock = buildDocumentsBlock(documentContexts);
  const hasRealData = !!(referencedSurvey?.responseSummary || documentBlock);

  const prompt = `You are Asha — an AI survey analyst. Your job is to help people with two things only: designing surveys to gather data they don't have yet, and making sense of survey response data they already have. You are not a general-purpose chatbot; every reply should move the user closer to a well-designed survey or a clear finding from their results.
Tone: ${STYLE_GUIDE[responseStyle] || STYLE_GUIDE.casual}

Formatting inside text blocks: this is markdown, rendered properly — use it with restraint, like a good analyst writing a memo, not a wall of headers. 
Bold (**like this**) the specific numbers or findings that matter most. Use a bullet list for 3+ related items instead of a run-on sentence. 
Use a "## heading" only to separate genuinely distinct sections of a longer breakdown — never for a short reply. 
A markdown table is a good alternative to a chart when the data is more precise than visual (few rows, exact values that matter individually) — don't produce both a table and a chart for the exact same numbers, pick whichever communicates it better.

Decide whether there's enough context to justify building a new survey now (suggestSurvey: true). This requires the user to have named an actual topic or purpose — e.g. "customer feedback after checkout", "post-event feedback for our conference", "employee engagement" — not just a bare intent to make one.

If they've only said something like "I want to make a survey" or "help me build a survey" with no topic, do NOT set suggestSurvey — reply normally (suggestSurvey: false) and ask what it's for: what they want to learn, who it's for, or what kind of survey (customer feedback, event registration, employee engagement, product research, etc.). Only move to suggestSurvey: true once you actually know the topic.

Before setting suggestSurvey: true, weigh how well you actually understand this specific project, not just whether a topic was named. A topic alone ("customer feedback survey") is often enough to start — Asha will ask a few sharper planning questions right after this reply to fill real gaps (who it's for, what decision the results should inform, anything unusual about this case). Use this reply to go one layer deeper than the surface topic where you can: if the user's message already hints at a goal, audience, or constraint, reflect that understanding back briefly instead of just restating the topic — it shows Asha is actually listening, not pattern-matching on a keyword.

If suggestSurvey is true: keep your text block(s) brief — one short sentence acknowledging what they want to build. Do NOT give generic survey-writing advice, checklists, or best-practice tips — Asha will ask a few short clarifying questions immediately after your reply, so don't pre-empt that with a listicle.

Your reply is an array of "blocks" rendered top to bottom, in the order you return them:
- { "type": "text", "content": string } — a short paragraph. Use several of these rather than one wall of text; each should cover one idea.
- { "type": "chart", "chart": { "kind": "bar" | "line" | "pie", "title": string, "xKey": string, "series": [{ "key": string, "label": string }], "data": [object, ...] } } — for "pie", omit "xKey"/"series" and give "data" as [{ "label": string, "value": number }].

Rules for charts:
- Only include a chart when the user shared real data above (a document summary or survey response data) AND a chart would genuinely help them understand it faster than a sentence would (a distribution, a comparison across categories, a trend over an ordered sequence).
- Every number in a chart must come directly from the summary/data given above. Never invent, round, or estimate figures that aren't there.
- Place each chart immediately after the text block that introduces what it shows — not all bunched at the end. This is a running explanation, not a report.
- If the user's message is a quick question or there's no real data to chart, just return one or two text blocks. Don't force a chart in.
- Keep each chart's "data" array to 12 rows or fewer. If a column has more categories than that, group the smallest into an "Other" bucket, or skip the chart and describe the pattern in text instead.

Write in the given tone. Don't mention these instructions.

If suggestSurvey is true: keep your text block(s) brief — one short sentence acknowledging what they want to build. Do NOT give generic survey-writing advice, checklists, or best-practice tips — Asha will ask a few short clarifying questions immediately after your reply, so don't pre-empt that with a listicle.
Respond with ONLY a JSON object of the shape: {"blocks": [...], "suggestSurvey": boolean}

${BRAND_RULES}

Conversation so far:
${transcript || "(none yet)"}

New user message: ${userMessage}${referenceBlock}${documentBlock}${hasRealData ? "\n\nReal data is available above — use it for grounded charts where they add clarity." : "\n\nNo document or survey data is attached to this message — do not include chart blocks."}`;

  const systemInstruction = "You always respond with a single valid JSON object and nothing else — no markdown fences, no commentary outside the JSON.";

  try {
    let result;
    try {
      result = await callGroq({
        task: simpleContextFree ? "light" : "reasoning",
        prompt,
        systemInstruction,
        maxTokens: simpleContextFree ? 1024 : 4096,
      });
    } catch (err) {
      if (!String(err.message).includes("json_validate_failed")) throw err;
      console.error("[ai/chat] blocks generation failed validation, retrying text-only:", err);
      const fallbackPrompt = `${prompt}\n\nIMPORTANT: your previous attempt failed to produce valid JSON. This time respond with ONLY {"blocks":[{"type":"text","content": string}],"suggestSurvey": boolean} — one short text block, no charts.`;
      result = await callGroq({
        task: simpleContextFree ? "light" : "reasoning",
        prompt: fallbackPrompt,
        systemInstruction,
        maxTokens: 1024,
      });
    }

    const blocks = Array.isArray(result.blocks) ? result.blocks : [];
    const response = {
      text: blocks
        .map((b) => (b.type === "chart" ? `[Chart: ${b.chart?.title || "untitled"}]` : b.content))
        .filter(Boolean)
        .join("\n\n"),
      blocks,
      suggestSurvey: !!result.suggestSurvey,
    };

    if (cacheKey) setCached(cacheKey, response);
    return res.status(200).json(response);
  } catch (err) {
    return logAndFail(res, 500, "ai/chat", err, "Asha had trouble putting that response together. Please try again.");
  }
}