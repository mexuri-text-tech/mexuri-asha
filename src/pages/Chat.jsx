import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Sidebar from "../components/Sidebar";
import ChatMessage from "../components/ChatMessage";
import SurveyBuildPanel from "../components/SurveyBuildPanel";
import UpgradePill from "../components/UpgradePill";
import PaymentModal from "../components/PaymentModal";
import SurveyPickerModal from "../components/SurveyPickerModal";
import * as db from "../lib/services/dbService";
import * as ai from "../lib/services/aiService";
import { recommendTemplate } from "../lib/templates/compatibility";
import styles from "./ChatHome.module.css";

// ---------- sparkle mark (Gemini-style four-point accent, own gradient) ----------
function SparkleIcon({ size = 32, className = "" }) {
  const gradId = "asha-sparkle-gradient";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4C8DF6" />
          <stop offset="55%" stopColor="#9168F0" />
          <stop offset="100%" stopColor="#F45FA0" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c.6 3.6 1.4 6 3 7.6 1.6 1.6 4 2.4 7 3-3 .6-5.4 1.4-7 3-1.6 1.6-2.4 4-3 7.6-.6-3.6-1.4-6-3-7.6-1.6-1.6-4-2.4-7-3 3-.6 5.4-1.4 7-3 1.6-1.6 2.4-4 3-7.6z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
}

// ---------- inline SVG icons (replaces lucide-react) ----------
function IconPlus({ size = 17, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconSend({ size = 15, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
      <path d="M6 12h16" />
    </svg>
  );
}

function IconStop({ size = 13, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function IconClipboard({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function IconSquarePen({ size = 17, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
    </svg>
  );
}

function IconFileText({ size = 12, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function IconX({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconLoader({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
// ---------- end icons ----------

// ---------- idle placeholder: typewriter-cycles through example prompts
// while the composer is empty and idle ----------
const IDLE_PROMPTS = [
  "Help me create a customer satisfaction survey",
  "Survey my team about remote work preferences",
  "Build a post-event feedback form",
  "What should I ask before launching a new product?",
  "Help me find out why customers are churning",
  "Create a quick employee engagement survey",
  "Ask my users what feature they want next",
];

function useIdlePlaceholder(active) {
  const [text, setText] = useState("Ask Asha…");

  useEffect(() => {
    if (!active) {
      setText("Ask Asha…");
      return;
    }

    let cancelled = false;
    const timers = [];
    const schedule = (fn, ms) => {
      const id = setTimeout(() => !cancelled && fn(), ms);
      timers.push(id);
    };

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let promptIndex = 0;

    function runPrompt() {
      const prompt = IDLE_PROMPTS[promptIndex % IDLE_PROMPTS.length];
      promptIndex += 1;

      if (reduceMotion) {
        setText(prompt);
        schedule(runPrompt, 3500);
        return;
      }

      let i = 0;
      function typeStep() {
        if (cancelled) return;
        i += 1;
        setText(prompt.slice(0, i));
        if (i < prompt.length) schedule(typeStep, 28);
        else schedule(eraseStep, 1800); // pause once fully typed
      }
      function eraseStep() {
        if (cancelled) return;
        i -= 1;
        setText(prompt.slice(0, Math.max(i, 0)));
        if (i > 0) schedule(eraseStep, 14);
        else schedule(runPrompt, 400); // brief pause, then next prompt
      }
      typeStep();
    }

    schedule(runPrompt, 1200); // small pause before the first prompt starts

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active]);

  return text;
}
// ---------- end idle placeholder ----------

// ---------- mobile keyboard awareness ----------
// Tracks how much of the viewport is covered by the on-screen keyboard
// (or browser chrome) using the visualViewport API. Returns 0 on browsers
// that don't support it (composer just stays in normal flow there).
function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    function handleResize() {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(offset)));
    }

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    handleResize();

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return inset;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
// ---------- end mobile keyboard awareness ----------

export default function Chat() {
  const { session, addChatToList, upsertChatMeta, removeChatFromList, addSurveyToList } = useApp();
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [activeChat, setActiveChat] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [planningLoading, setPlanningLoading] = useState(false);
  const [draftingSurvey, setDraftingSurvey] = useState(false); // drafting + choosing a design suggestion, after planning Qs
  const [thinkingLabel, setThinkingLabel] = useState("Thinking"); // "Thinking" | "Analyzing" — shown next to the reply dots

  const [mySurveys, setMySurveys] = useState([]);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [referencedSurvey, setReferencedSurvey] = useState(null);
  const [mode, setMode] = useState("chat"); // "chat" | "analyse"

  const [planningQuestions, setPlanningQuestions] = useState(null); // array | null
  const [planningIndex, setPlanningIndex] = useState(0);
  const [planningAnswers, setPlanningAnswers] = useState({});
  const [buildPanel, setBuildPanel] = useState(null); // { building, survey } | null
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const scrollRef = useRef(null);
  // One AbortController for whichever request is currently in flight
  // (a fresh send, a regenerate, or an edit-resend) — Stop just aborts it.
  const abortRef = useRef(null);

  // keyboard-aware fixed composer (mobile only)
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset();
  const composerWrapRef = useRef(null);
  const [composerHeight, setComposerHeight] = useState(0);

  useEffect(() => {
    const el = composerWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setComposerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (session?.id) {
      db.listSurveys(session.id)
        .then(setMySurveys)
        .catch((err) => setErrorMsg(err.message || "Couldn't load your surveys."));
    }
  }, [session?.id]);

  useEffect(() => {
    if (!chatId) { setActiveChat(null); return; }
    let active = true;
    db.getChat(chatId)
      .then((c) => {
        if (!active) return;
        if (!c) { navigate("/chat", { replace: true }); return; } // chat doesn't exist/was deleted
        setActiveChat(c);
      })
      .catch((err) => active && setErrorMsg(err.message || "Couldn't load that chat."));
    return () => { active = false; };
  }, [chatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeChat?.messages?.length]);

  function handleNewChat() {
    navigate("/chat");
    setInput("");
    setReferencedSurvey(null);
    setPlanningQuestions(null);
  }

  function handleSelectChat(id) {
    navigate(`/chat/${id}`);
  }

  function openSurveyModal() {
    setSurveyModalOpen(true);
  }

  async function pickReference(survey) {
    try {
      const full = await db.getSurvey(survey.id); // pulls questions + responses
      setReferencedSurvey(full);
      setMode("analyse");
    } catch (err) {
      setErrorMsg(err.message || "Couldn't load that survey.");
    }
    setSurveyModalOpen(false);
  }

  function clearReference() {
    setReferencedSurvey(null);
  }

  // Leaving Analyse mode drops whatever survey was attached — going back
  // in starts clean rather than silently re-using a stale reference.
  function handleModeChange(next) {
    setMode(next);
    if (next === "chat") setReferencedSurvey(null);
  }

  function stopSending() {
    abortRef.current?.abort();
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setErrorMsg("");
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let chat = activeChat;
      if (!chat) {
        chat = await db.createChat(session.id);
        setActiveChat(chat);
        addChatToList(chat);
        navigate(`/chat/${chat.id}`, { replace: true });
      }

      const userMsg = await db.appendMessage(chat.id, {
        role: "user",
        text,
        referencedSurveyId: referencedSurvey?.id,
        referencedSurveyTitle: referencedSurvey?.title,
      });
      chat = { ...chat, messages: [...chat.messages, userMsg] };
      setActiveChat(chat);

      setThinkingLabel(referencedSurvey ? "Analyzing" : "Thinking");
      const titlePromise = !chat.titleLocked ? ai.generateChatTitle(text) : Promise.resolve(null);
      const replyPromise = ai.sendMessage({
        history: chat.messages,
        userMessage: text,
        responseStyle: session.responseStyle,
        referencedSurvey: referencedSurvey || null,
        documentContexts: [],
        mode,
        signal: controller.signal,
      });

      // Title generation and the AI reply are independent — run them
      // together instead of waiting on one before starting the other.
      const [title, reply] = await Promise.all([titlePromise, replyPromise]);

      if (title) {
        await db.updateChat(chat.id, { title, titleLocked: true });
        chat = { ...chat, title, titleLocked: true };
        upsertChatMeta(chat.id, { title, titleLocked: true });
      }

      const assistantMsg = await db.appendMessage(chat.id, {
        role: "assistant",
        text: reply.text,
        blocks: reply.blocks,
        suggestSurvey: reply.suggestSurvey,
      });
      chat = { ...chat, messages: [...chat.messages, assistantMsg] };
      setActiveChat(chat);
      upsertChatMeta(chat.id, { title: chat.title });

      // Ask the defining/planning questions right away instead of waiting
      // for a manual "Start Survey" click — Asha should understand the
      // survey before building it, not after an extra step.
      if (reply.suggestSurvey && !chat.surveyDraftId) {
        handleStartSurvey(chat.messages);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // User hit Stop — the user message they sent stays in the thread,
        // it just never got a reply. Nothing else to clean up.
      } else {
        console.error(err);
        setErrorMsg(err.message || "Something went wrong reaching Asha. Please try again.");
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  // Re-asks Asha using everything up to (but not including) the target
  // assistant message, then swaps that message's content in place — the
  // rest of the thread, and the DB row's id/position, stay untouched.
  async function handleRegenerate(messageId) {
    if (sending || regeneratingId || editingId) return;
    const messages = activeChat?.messages || [];
    const targetIndex = messages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) return;

    const priorHistory = messages.slice(0, targetIndex);
    const lastUserMsg = [...priorHistory].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    setRegeneratingId(messageId);
    setErrorMsg("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await ai.sendMessage({
        history: priorHistory,
        userMessage: lastUserMsg.text,
        responseStyle: session.responseStyle,
        referencedSurvey: referencedSurvey || null,
        mode,
        signal: controller.signal,
      });

      const updated = await db.updateMessage(messageId, {
        text: reply.text,
        blocks: reply.blocks,
        suggestSurvey: reply.suggestSurvey,
      });

      setActiveChat((chat) => ({
        ...chat,
        messages: chat.messages.map((m) => (m.id === messageId ? { ...m, ...updated } : m)),
      }));
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        setErrorMsg(err.message || "Couldn't regenerate that response. Please try again.");
      }
    } finally {
      setRegeneratingId(null);
      abortRef.current = null;
    }
  }

  // Regenerating a USER message means re-running whatever assistant reply
  // followed it (the user's own text doesn't change) — so this just finds
  // that reply and reuses handleRegenerate.
  function handleRegenerateFromUserMessage(userMessageId) {
    const messages = activeChat?.messages || [];
    const idx = messages.findIndex((m) => m.id === userMessageId);
    const next = messages[idx + 1];
    if (next?.role === "assistant") handleRegenerate(next.id);
  }

  // messageId === null closes the editor without saving.
  async function handleEditMessage(messageId, newText) {
    if (messageId === null) {
      setEditingId(null);
      return;
    }
    if (newText === undefined) {
      setEditingId(messageId); // open the editor
      return;
    }
    if (sending || regeneratingId) return;

    const messages = activeChat?.messages || [];
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const target = messages[idx];

    setSending(true);
    setEditingId(null);
    setErrorMsg("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const updatedMsg = await db.updateMessage(messageId, { text: newText });
      // Drop everything that came after the edited message — an edit
      // restarts the thread from that point, it doesn't fork it.
      await db.deleteMessagesAfter(activeChat.id, target.createdAt);

      const truncated = messages.slice(0, idx + 1).map((m) => (m.id === messageId ? { ...m, ...updatedMsg } : m));
      let chat = { ...activeChat, messages: truncated };
      setActiveChat(chat);

      const reply = await ai.sendMessage({
        history: truncated.slice(0, idx),
        userMessage: newText,
        responseStyle: session.responseStyle,
        referencedSurvey: referencedSurvey || null,
        mode,
        signal: controller.signal,
      });

      const assistantMsg = await db.appendMessage(chat.id, {
        role: "assistant",
        text: reply.text,
        blocks: reply.blocks,
        suggestSurvey: reply.suggestSurvey,
      });
      chat = { ...chat, messages: [...chat.messages, assistantMsg] };
      setActiveChat(chat);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        setErrorMsg(err.message || "Couldn't save that edit. Please try again.");
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function conversationTranscript() {
    return (activeChat?.messages || []).map((m) => `${m.role}: ${m.text}`).join("\n");
  }

  async function handleStartSurvey(messagesOverride) {
    setPlanningLoading(true);
    setErrorMsg("");
    try {
      const source = messagesOverride || activeChat?.messages || [];
      const transcript = source.map((m) => `${m.role}: ${m.text}`).join("\n");
      const questions = await ai.generatePlanningQuestions(transcript);
      if (!questions.length) {
        // Asha already understands the project well enough from the chat —
        // skip the planning step and go straight to drafting the survey.
        await handlePlanningComplete({});
        return;
      }
      setPlanningQuestions(questions);
      setPlanningIndex(0);
      setPlanningAnswers({});
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Couldn't start survey planning. Please try again.");
    } finally {
      setPlanningLoading(false);
    }
  }

  async function handlePlanningComplete(answers) {
    const askedQuestions = planningQuestions || [];
    setPlanningQuestions(null);
    setDraftingSurvey(true);
    setErrorMsg("");

    try {
      const planningQA = askedQuestions
        .map((q) => `Q: ${q.text}\nA: ${answers[q.id] || "(skipped)"}`)
        .join("\n\n");

      const chatContext = [
        "Conversation with the founder:",
        conversationTranscript(),
        "",
        "Planning answers the founder just gave:",
        planningQA,
      ].join("\n");

      const drafted = await ai.generateSurvey({ chatContext });
      const recommended = recommendTemplate(drafted.questions);

      const suggestionMsg = await db.appendMessage(activeChat.id, {
        role: "assistant",
        text: `I've drafted "${drafted.title}". Pick a design direction and I'll build it.`,
        blocks: [
          { type: "text", content: `I've drafted **${drafted.title}**. Pick a design direction and I'll build it.` },
          {
            type: "templateSuggestion",
            draft: drafted,
            questions: drafted.questions,
            templateId: recommended.id,
            locked: false,
          },
        ],
      });
      setActiveChat((chat) => ({ ...chat, messages: [...chat.messages, suggestionMsg] }));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Couldn't draft the survey. Please try again.");
    } finally {
      setDraftingSurvey(false);
    }
  }

  // Fires when the founder picks a template on the in-chat design
  // suggestion card — this is the moment the survey actually gets created.
  async function handleConfirmDesign(messageId, templateId, draft) {
    setBuildPanel({ building: true, survey: null });
    setErrorMsg("");

    try {
      const survey = await db.createSurvey(session.id, { ...draft, templateId });
      await db.updateChat(activeChat.id, { surveyDraftId: survey.id });
      setBuildPanel({ building: false, survey });
      setMySurveys((prev) => [survey, ...prev]);
      addSurveyToList(survey);

      // Lock the card in place so it reads as decided rather than still pickable.
      const msg = activeChat.messages.find((m) => m.id === messageId);
      let updatedMsg = msg;
      if (msg?.blocks) {
        const newBlocks = msg.blocks.map((b) =>
          b.type === "templateSuggestion" ? { ...b, templateId, locked: true } : b
        );
        updatedMsg = await db.updateMessage(messageId, { blocks: newBlocks });
      }

      setActiveChat((chat) => ({
        ...chat,
        surveyDraftId: survey.id,
        messages: chat.messages.map((m) => (m.id === messageId ? updatedMsg : m)),
      }));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Couldn't build the survey. Please try again.");
      setBuildPanel(null);
    }
  }

  async function handleDeleteChat(id) {
    await db.deleteChat(id);
    if (activeChat?.id === id) navigate("/chat");
    removeChatFromList(id);
  }

  // Extra breathing room below the last message so it never sits hidden
  // behind the composer — on mobile that's the fixed composer + on-screen
  // keyboard, but we pad on desktop too so long messages never end up
  // flush against the composer.
  const COMPOSER_BUFFER = 150; // extra px cushion beyond the composer's own height
  const scrollPaddingBottom = isMobile
    ? composerHeight + keyboardInset + COMPOSER_BUFFER
    : composerHeight + COMPOSER_BUFFER;

  return (
    <div className="h-[100dvh] w-full bg-canvas flex overflow-hidden">
      <Sidebar
        activeChat={activeChat?.id}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <div className="flex-1 min-w-0 flex">
        <div className="flex-1 min-w-0 flex flex-col relative">
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0">
            {/* <UpgradePill onClick={() => setShowPaymentModal(true)} /> */}
            <button
              onClick={handleNewChat}
              title="New chat"
              className="focus-ring w-8 h-8 rounded-lg flex items-center justify-center text-ink/60 hover:text-ink hover:bg-panel transition"
            >
              <IconSquarePen size={17} />
            </button>
          </div>

          {showPaymentModal && <PaymentModal onClose={() => setShowPaymentModal(false)} />}

          {errorMsg && (
            <div className="mx-6 mb-2 flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3.5 py-2.5">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")} className="focus-ring text-red-400/70 hover:text-red-400 shrink-0">
                <IconX size={14} />
              </button>
            </div>
          )}

          {/* messages / empty state */}
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className={styles.homeScreen}>
              <div className={styles.homeContent}>
                <h1 className={styles.greeting}>
                  {session?.name ? `What's the vibe, ${session.name}?` : "What's the vibe?"}
                </h1>
                <div style={{ width: "100%", maxWidth: 640 }}>
                  <Composer
                    input={input}
                    setInput={setInput}
                    onSend={handleSend}
                    onStop={stopSending}
                    sending={sending}
                    centered
                    mySurveys={mySurveys}
                    referencedSurvey={referencedSurvey}
                    onPickReference={pickReference}
                    onClearReference={clearReference}
                    mode={mode}
                    onModeChange={handleModeChange}
                    surveyModalOpen={surveyModalOpen}
                    onOpenSurveyModal={openSurveyModal}
                    onCloseSurveyModal={() => setSurveyModalOpen(false)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 py-4 space-y-6"
                style={{ paddingBottom: scrollPaddingBottom }}
              >
                <div className="max-w-3xl mx-auto space-y-6">
                  {activeChat.messages.map((m) => (
                    <ChatMessage
                      key={m.id}
                      message={m}
                      onConfirmDesign={handleConfirmDesign}
                      surveyBuilt={!!activeChat.surveyDraftId}
                      onRegenerate={m.role === "user" ? handleRegenerateFromUserMessage : handleRegenerate}
                      regenerating={regeneratingId === m.id || (m.role === "user" && regeneratingId === activeChat.messages[activeChat.messages.findIndex(x => x.id === m.id) + 1]?.id)}
                      onEdit={handleEditMessage}
                      editing={editingId === m.id}
                      busy={sending || !!regeneratingId || !!editingId}
                    />
                  ))}
                  {sending && (
                    <div className="flex items-center gap-2 text-ink/30">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulseSoft" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulseSoft [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulseSoft [animation-delay:300ms]" />
                      </div>
                      <span className="text-xs">{thinkingLabel}…</span>
                    </div>
                  )}
                </div>
              </div>

              {/*
                On mobile, this wrapper is pinned to the bottom of the visual
                viewport (not the layout viewport), and its `bottom` offset
                tracks the on-screen keyboard height via useKeyboardInset.
                That keeps the textarea sitting just above the keyboard
                instead of being pushed off-screen or buried under it.
                Desktop keeps the original in-flow, static positioning.
              */}
              <div
                ref={composerWrapRef}
                className={`px-6 pb-6 shrink-0 z-30 bg-canvas ${isMobile ? "fixed inset-x-0" : ""}`}
                style={isMobile ? { bottom: keyboardInset } : undefined}
              >
                <div className="max-w-2xl mx-auto">
                  {planningLoading ? (
                    <StatusPreloader label="Thinking" description="Asha is thinking through what to ask…" />
                  ) : draftingSurvey ? (
                    <StatusPreloader label="Designing" description="Asha is designing your survey…" />
                  ) : planningQuestions ? (
                    <PlanningComposer
                      questions={planningQuestions}
                      index={planningIndex}
                      setIndex={setPlanningIndex}
                      answers={planningAnswers}
                      setAnswers={setPlanningAnswers}
                      onComplete={handlePlanningComplete}
                      onCancel={() => setPlanningQuestions(null)}
                    />
                  ) : (
                    <Composer
                      input={input}
                      setInput={setInput}
                      onSend={handleSend}
                      onStop={stopSending}
                      sending={sending}
                      mySurveys={mySurveys}
                      referencedSurvey={referencedSurvey}
                      onPickReference={pickReference}
                      onClearReference={clearReference}
                      mode={mode}
                      onModeChange={handleModeChange}
                      surveyModalOpen={surveyModalOpen}
                      onOpenSurveyModal={openSurveyModal}
                      onCloseSurveyModal={() => setSurveyModalOpen(false)}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {buildPanel && (
          <SurveyBuildPanel
            survey={buildPanel.survey}
            building={buildPanel.building}
            onClose={() => setBuildPanel(null)}
          />
        )}
      </div>
    </div>
  );
}

const TEXTAREA_MAX_HEIGHT = 500;

function Composer({
  input, setInput, onSend, onStop, sending, centered, mySurveys, referencedSurvey,
  onPickReference, onClearReference,
  mode, onModeChange, surveyModalOpen, onOpenSurveyModal, onCloseSurveyModal,
}) {
  const textareaRef = useRef(null);
  const isAnalyse = mode === "analyse";
  const idlePlaceholder = useIdlePlaceholder(!input && !sending && !isAnalyse);
  // Tracks whether the textarea has grown past one line — the pill relaxes
  // from a true stadium shape to a large rounded rect once that happens
  // (see .composerPill[data-expanded] in ChatHome.module.css).
  const [expanded, setExpanded] = useState(false);

  // Refocus once a send finishes — covers both "clicked the send button"
  // (which naturally steals focus) and the very first message, where the
  // composer remounts moving from the centered empty state to the docked one.
  useEffect(() => {
    if (!sending) textareaRef.current?.focus();
  }, [sending]);

  // Auto-expand the textarea as the user types, capped at TEXTAREA_MAX_HEIGHT —
  // beyond that it scrolls internally instead of growing further.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
    setExpanded(next > 44);
  }, [input]);

  return (
    <div
      className={styles.composerPill}
      data-expanded={expanded}
      style={centered ? { boxShadow: "none" } : undefined}
    >
      {referencedSurvey && (
        <div className={styles.surveyChip}>
          <span className={styles.surveyChipIcon}>
            <IconFileText size={16} />
          </span>
          <div className={styles.surveyChipText}>
            <span className={styles.surveyChipLabel}>Analysing</span>
            <span className={styles.surveyChipTitle}>{referencedSurvey.title}</span>
          </div>
          <button onClick={onClearReference} className={`focus-ring ${styles.surveyChipClose}`}>
            <IconX size={13} />
          </button>
        </div>
      )}
      <div className={styles.composerRow}>
        <button
          onClick={onOpenSurveyModal}
          title="Add a survey to analyse"
          className={`focus-ring ${styles.iconButton}`}
        >
          <IconPlus size={17} />
        </button>

        <textarea
          ref={textareaRef}
          autoFocus
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={isAnalyse && !referencedSurvey ? "Add a survey to analyse…" : idlePlaceholder}
          className={styles.composerTextarea}
          style={{ maxHeight: TEXTAREA_MAX_HEIGHT }}
        />

        <button
          onClick={sending ? onStop : onSend}
          disabled={!sending && (!input.trim() || (isAnalyse && !referencedSurvey))}
          className={`focus-ring ${styles.sendButton}`}
          title={sending ? "Stop" : "Send"}
        >
          {sending ? <IconStop size={13} /> : <IconSend size={15} />}
        </button>
      </div>

      <div className={styles.composerFooter}>
        <div className={styles.modeToggle} role="tablist" aria-label="Asha mode">
          <button
            role="tab"
            aria-selected={!isAnalyse}
            onClick={() => onModeChange("chat")}
            className={styles.modeToggleBtn}
            data-active={!isAnalyse}
          >
            Chat
          </button>
          <button
            role="tab"
            aria-selected={isAnalyse}
            onClick={() => onModeChange("analyse")}
            className={styles.modeToggleBtn}
            data-active={isAnalyse}
          >
            Analyse
          </button>
        </div>

        {isAnalyse && !referencedSurvey && (
          <span className={styles.composerHint}>
            Tap <IconPlus size={10} /> to pick a survey
          </span>
        )}
      </div>

      {surveyModalOpen && (
        <SurveyPickerModal
          surveys={mySurveys}
          onPick={onPickReference}
          onClose={onCloseSurveyModal}
        />
      )}
    </div>
  );
}

// Inline replacement for the composer while planning questions are being
// asked — same information as the old fullscreen modal, just docked in
// place instead of interrupting the chat.
function PlanningComposer({ questions, index, setIndex, answers, setAnswers, onComplete, onCancel }) {
  const q = questions[index];
  const selected = answers[q.id];
  const isLast = index === questions.length - 1;

  function selectOption(opt) {
    setAnswers((a) => ({ ...a, [q.id]: opt }));
  }

  function handleNext() {
    if (!selected) return;
    if (isLast) onComplete(answers);
    else setIndex(index + 1);
  }

  return (
    <div className="bg-panel border border-line rounded-2xl p-4 shadow-modal">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-ink/40">
          Question {index + 1} of {questions.length}
        </span>
        <button onClick={onCancel} className="focus-ring text-ink/40 hover:text-ink text-xs">
          Cancel
        </button>
      </div>
      <div className="h-1 bg-line rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-accent-from via-accent-via to-accent-to transition-all duration-300"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>
      <p className="text-sm font-medium mb-3">{q.text}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => selectOption(opt)}
            className={`focus-ring text-xs px-3 py-2 rounded-full border transition ${selected === opt
              ? "border-accent-soft bg-accent-soft/10 text-ink"
              : "border-line2 text-ink/60 hover:border-ink/30 hover:text-ink"
              }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="focus-ring text-xs text-ink/40 hover:text-ink disabled:opacity-30"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className="focus-ring bg-btn text-btn-foreground disabled:opacity-30 font-medium text-xs px-4 py-2 rounded-lg hover:bg-btn/90 hover:shadow-[0_0_16px_rgba(109,94,248,0.35)] transition"
        >
          {isLast ? "Build survey" : "Next"}
        </button>
      </div>
    </div>
  );
}

function StatusPreloader({ label, description }) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-4 shadow-modal flex items-center gap-3">
      <IconLoader size={16} className="animate-spin text-accent-soft" />
      <div>
        <p className="text-sm text-ink/70 font-medium">{label}…</p>
        <p className="text-xs text-ink/40">{description}</p>
      </div>
    </div>
  );
}