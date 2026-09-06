// dbService.js — real Supabase implementation.
// This file was still the localStorage MOCK in the uploaded build —
// that's why nothing was actually persisting to Supabase. All chats,
// messages, surveys, questions, and responses now go through the
// tables in supabase/schema.sql. Every function is async.

import { supabase } from "../supabaseClient";
import { recommendTemplate } from "../templates/compatibility";

function genSlug() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const chunk = (n) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${chunk(3)}-${chunk(4)}-${chunk(3)}`;
}

function mapMessageRow(row) {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    suggestSurvey: row.suggest_survey,
    referencedSurveyId: row.referenced_survey_id || undefined,
    referencedSurveyTitle: row.referenced_survey_title || undefined,
    // New rows use the attachments jsonb array; fall back to the old
    // singular columns so messages sent before this change still render.
    attachments: row.attachments || (row.attachment_name
      ? [{ fileName: row.attachment_name, type: row.attachment_type, summary: row.attachment_summary, path: row.attachment_path }]
      : []),
    blocks: row.blocks || null,
    feedback: row.feedback || null,
    createdAt: row.created_at,
  };
}

function mapChatRow(row, messages = []) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    titleLocked: row.title_locked,
    surveyDraftId: row.survey_draft_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
  };
}

function mapQuestionRow(row) {
  return { id: row.id, type: row.type, text: row.text, options: row.options || undefined };
}

function mapSurveyRow(row, questions = [], responses = []) {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverColorSeed: row.cover_color_seed,
    status: row.status,
    templateId: row.template_id || null,
    seenAt: row.seen_at || null,
    createdAt: row.created_at,
    questions,
    responses,
  };
}

// ---------- Chats ----------

export async function listChats(userId) {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => mapChatRow(row));
}

export async function markSurveySeen(surveyId) {
  const { error } = await supabase
    .from("surveys")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", surveyId)
    .is("seen_at", null); // don't clobber the original "first seen" timestamp on repeat visits
  if (error) throw error;
}

export async function getChat(chatId) {
  const { data: chatRow, error: chatErr } = await supabase
    .from("chats").select("*").eq("id", chatId).maybeSingle();
  if (chatErr) throw chatErr;
  if (!chatRow) return null;                 // ← instead of throwing

  const { data: msgRows, error: msgErr } = await supabase
    .from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true });
  if (msgErr) throw msgErr;
  return mapChatRow(chatRow, msgRows.map(mapMessageRow));
}

// second arg accepted (and ignored) for backwards compatibility with the
// call site that still passes the first message text — the title comes
// from generateChatTitle() once the AI reply lands, not from here.
export async function createChat(userId) {
  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: userId, title: "New chat", title_locked: false })
    .select()
    .single();
  if (error) throw error;
  return mapChatRow(data, []);
}

export async function updateChat(chatId, patch) {
  const columns = { updated_at: new Date().toISOString() };
  if ("title" in patch) columns.title = patch.title;
  if ("titleLocked" in patch) columns.title_locked = patch.titleLocked;
  if ("surveyDraftId" in patch) columns.survey_draft_id = patch.surveyDraftId;

  const { error } = await supabase.from("chats").update(columns).eq("id", chatId);
  if (error) throw error;
  return getChat(chatId);
}

export async function appendMessage(chatId, message) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      role: message.role,
      text: message.text,
      suggest_survey: message.suggestSurvey || false,
      referenced_survey_id: message.referencedSurveyId || null,
      referenced_survey_title: message.referencedSurveyTitle || null,
      attachments: message.attachments?.length ? message.attachments : null,
      blocks: message.blocks || null,
    })
    .select()
    .single();
  if (error) throw error;
  supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId).then(() => { });
  return mapMessageRow(data);
}

// Used by regenerate (swap text/blocks on an existing assistant message)
// and by edit (rewrite a user message's text in place).
export async function updateMessage(messageId, patch) {
  const row = {};
  if (patch.text !== undefined) row.text = patch.text;
  if (patch.blocks !== undefined) row.blocks = patch.blocks;
  if (patch.suggestSurvey !== undefined) row.suggest_survey = patch.suggestSurvey;
  if (patch.feedback !== undefined) row.feedback = patch.feedback;

  const { data, error } = await supabase
    .from("messages")
    .update(row)
    .eq("id", messageId)
    .select()
    .single();
  if (error) throw error;
  return mapMessageRow(data);
}

// Regenerate/edit both need to drop everything after a given point in the
// conversation before appending the new reply, so the transcript stays a
// single linear thread instead of branching.
export async function deleteMessagesAfter(chatId, createdAt) {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId)
    .gt("created_at", createdAt);
  if (error) throw error;
}

export async function deleteChat(chatId) {
  const { error } = await supabase.from("chats").delete().eq("id", chatId);
  if (error) throw error;
}

// ---------- Surveys ----------

export async function listSurveys(userId) {
  const { data, error } = await supabase
    .from("surveys")
    .select("*, responses(id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => mapSurveyRow(row, [], row.responses || []));
}

export async function getSurvey(surveyId) {
  const { data: surveyRow, error: surveyErr } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .single();
  if (surveyErr) throw surveyErr;

  const { data: questionRows, error: qErr } = await supabase
    .from("questions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: true });
  if (qErr) throw qErr;

  const { data: responseRows, error: rErr } = await supabase
    .from("responses")
    .select("*")
    .eq("survey_id", surveyId)
    .order("submitted_at", { ascending: false });
  if (rErr) throw rErr;

  return mapSurveyRow(
    surveyRow,
    questionRows.map(mapQuestionRow),
    responseRows.map((r) => ({ id: r.id, answers: r.answers, submittedAt: r.submitted_at }))
  );
}

// Used by the public /s/:slug page — only ever returns published
// surveys, matching the RLS policy in supabase/schema.sql.
export async function getSurveyBySlug(slug) {
  const { data: surveyRow, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (error) return null;

  const { data: questionRows } = await supabase
    .from("questions")
    .select("*")
    .eq("survey_id", surveyRow.id)
    .order("order_index", { ascending: true });

  return mapSurveyRow(surveyRow, (questionRows || []).map(mapQuestionRow));
}

export async function createSurvey(userId, { title, description, coverColorSeed, questions, templateId }) {
  const resolvedTemplateId = templateId || recommendTemplate(questions).id;

  const { data: surveyRow, error: surveyErr } = await supabase
    .from("surveys")
    .insert({
      user_id: userId,
      slug: genSlug(),
      title,
      description,
      cover_color_seed: coverColorSeed ?? Math.floor(Math.random() * 360),
      status: "draft",
      template_id: resolvedTemplateId,
    })
    .select()
    .single();
  if (surveyErr) throw surveyErr;

  const questionRows = questions.map((q, i) => ({
    survey_id: surveyRow.id,
    type: q.type,
    text: q.text,
    options: q.options ?? null,
    order_index: i,
  }));
  const { data: insertedQuestions, error: qErr } = await supabase
    .from("questions")
    .insert(questionRows)
    .select();
  if (qErr) throw qErr;

  return mapSurveyRow(surveyRow, insertedQuestions.map(mapQuestionRow), []);
}

export async function setSurveyStatus(surveyId, status) {
  const { error } = await supabase.from("surveys").update({ status }).eq("id", surveyId);
  if (error) throw error;
  return getSurvey(surveyId);
}

// Called from the template picker (build panel, survey detail page, and
// the in-chat design suggestion card) whenever the founder swaps templates.
export async function setSurveyTemplate(surveyId, templateId) {
  const { error } = await supabase
    .from("surveys")
    .update({ template_id: templateId })
    .eq("id", surveyId);
  if (error) throw error;
  return getSurvey(surveyId);
}

export async function deleteSurvey(surveyId) {
  const { error } = await supabase.from("surveys").delete().eq("id", surveyId);
  if (error) throw error;
}

// Manual editing from SurveyDetail: title/description plus a full
// replacement of the question set. Simplest correct approach given
// questions can be added/removed/reordered in the same save — delete
// the old rows and reinsert rather than trying to diff them.
export async function updateSurvey(surveyId, { title, description, questions }) {
  const { error: surveyErr } = await supabase
    .from("surveys")
    .update({ title, description })
    .eq("id", surveyId);
  if (surveyErr) throw surveyErr;

  const { error: delErr } = await supabase.from("questions").delete().eq("survey_id", surveyId);
  if (delErr) throw delErr;

  const questionRows = questions.map((q, i) => ({
    survey_id: surveyId,
    type: q.type,
    text: q.text,
    options: q.type !== "text" ? q.options ?? [] : null,
    order_index: i,
  }));
  const { error: qErr } = await supabase.from("questions").insert(questionRows);
  if (qErr) throw qErr;

  return getSurvey(surveyId);
}

export async function submitResponse(surveyId, answers) {
  const { error } = await supabase.from("responses").insert({ survey_id: surveyId, answers });
  if (error) throw error;
  return getSurvey(surveyId);
}