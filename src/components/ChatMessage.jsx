import { useState, useEffect, useRef } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCw, FileText, Pencil } from "lucide-react";
import ChatChart from "./ChatChart";
import TemplateSuggestionCard from "./survey-templates/TemplateSuggestionCard";
import MarkdownText from "./MarkdownText";

export default function ChatMessage({
  message,
  onConfirmDesign,
  surveyBuilt,
  onRegenerate,
  regenerating,
  onEdit,
  editing,
  busy, // true while ANY send/edit/regenerate is in flight — disables actions app-wide
  onFeedback,
}) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const [confirming, setConfirming] = useState(false);
  const textareaRef = useRef(null);

  function handleCopy() {
    navigator.clipboard?.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  useEffect(() => {
    if (editing) {
      setDraft(message.text);
      // Let the textarea mount before focusing/sizing it.
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      });
    }
  }, [editing, message.text]);

  function autosize(e) {
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      onEdit?.(null);
    }
  }

  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.text) {
      onEdit?.(null); // no real change — just close the editor
      return;
    }
    onEdit?.(message.id, trimmed);
  }

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end animate-fadeInUp group">
        {message.referencedSurveyTitle && (
          <div className="flex items-center gap-1.5 mb-1.5 bg-panel border border-line rounded-lg px-2 py-1 max-w-[80%]">
            <FileText size={11} className="text-ink/40 shrink-0" />
            <span className="text-[11px] text-ink/60 truncate">{message.referencedSurveyTitle}</span>
          </div>
        )}
        {editing ? (
          <div className="w-full max-w-[90%] bg-panel2 rounded-2xl px-4 py-2.5">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); autosize(e); }}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full bg-transparent text-sm resize-none outline-none leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => onEdit?.(null)}
                className="focus-ring text-xs font-medium text-ink/50 hover:text-ink px-3 py-1.5 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={busy}
                className="focus-ring text-xs font-medium bg-btn text-btn-foreground rounded-lg px-3 py-1.5 hover:bg-btn/90 transition disabled:opacity-50"
              >
                Save & submit
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-panel2 rounded-2xl px-4 py-2.5 max-w-[80%] text-sm">{message.text}</div>
            <div className="flex items-center gap-3 mt-1.5 text-ink/35 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button onClick={handleCopy} className="focus-ring hover:text-ink transition" title={copied ? "Copied" : "Copy"}>
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
              <button
                onClick={() => onEdit?.(message.id)}
                disabled={busy}
                className="focus-ring hover:text-ink transition disabled:opacity-40"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onRegenerate?.(message.id)}
                disabled={busy}
                className="focus-ring hover:text-ink transition disabled:opacity-40"
                title="Regenerate"
              >
                <RotateCw size={13} className={regenerating ? "animate-spin" : ""} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }


  async function handlePickDesign(templateId, draft) {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirmDesign?.(message.id, templateId, draft);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="max-w-[85%] animate-fadeInUp">
      {Array.isArray(message.blocks) && message.blocks.length > 0 ? (
        message.blocks.map((block, i) =>
          block.type === "chart" ? (
            <ChatChart key={i} chart={block.chart} />
          ) : block.type === "templateSuggestion" ? (
            <TemplateSuggestionCard
              key={i}
              questions={block.questions}
              templateId={block.templateId}
              reason={block.reason}
              locked={block.locked}
              building={confirming}
              onSelect={(id) => handlePickDesign(id, block.draft)}
            />
          ) : (
            <MarkdownText key={i} content={block.content} />
          )
        )
      ) : (
        <MarkdownText content={message.text} />
      )}

      {message.suggestSurvey && surveyBuilt && (
        <div className="mt-3 inline-block border border-line rounded-xl px-3.5 py-2">
          <MarkdownText content="✅ **Survey created**" />
        </div>
      )}

      <div className="flex items-center gap-3 mt-2.5 text-ink/35">
        <button onClick={handleCopy} className="focus-ring hover:text-ink transition" title={copied ? "Copied" : "Copy"}>
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
        <button
          onClick={() => onFeedback?.(message.id, "up")}
          className={`focus-ring hover:text-ink transition ${message.feedback === "up" ? "text-emerald-400" : ""}`}
          title="Good response"
          aria-pressed={message.feedback === "up"}
        >
          <ThumbsUp size={14} fill={message.feedback === "up" ? "currentColor" : "none"} />
        </button>
        <button
          onClick={() => onFeedback?.(message.id, "down")}
          className={`focus-ring hover:text-ink transition ${message.feedback === "down" ? "text-rose-400" : ""}`}
          title="Bad response"
          aria-pressed={message.feedback === "down"}
        >
          <ThumbsDown size={14} fill={message.feedback === "down" ? "currentColor" : "none"} />
        </button>
        <button
          onClick={() => onRegenerate?.(message.id)}
          disabled={regenerating}
          className="focus-ring hover:text-ink transition disabled:opacity-40"
          title="Regenerate"
        >
          <RotateCw size={14} className={regenerating ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}