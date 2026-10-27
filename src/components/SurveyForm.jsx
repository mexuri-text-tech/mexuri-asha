import { CheckCircle2, Eye } from "lucide-react";

// The actual question-answering UI — used by both the live public /s/:slug
// page (real, submittable) and the in-app Preview modal (read-only, nothing
// is ever recorded). `interactive: false` disables all inputs and answer
// state so the preview can't be mistaken for a real submission.
export function SurveyForm({ survey, answers, setAnswer, toggleMulti, interactive = true }) {
  function isSelected(q, opt) {
    if (!answers) return false;
    if (q.type === "multi") return (answers[q.id] || []).includes(opt);
    return answers[q.id] === opt;
  }

  return (
    <div className="space-y-8">
      {survey.questions.map((q, i) => (
        <div key={q.id}>
          <div className="text-xs text-ink/35 mb-1.5">Question {i + 1}</div>
          <div className="text-sm font-medium mb-3">{q.text}</div>

          {q.type === "single" && (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  disabled={!interactive}
                  onClick={() => interactive && setAnswer(q.id, opt)}
                  className={`focus-ring w-full text-left text-sm rounded-xl border px-4 py-3 transition ${isSelected(q, opt) ? "border-accent-soft bg-accent-soft/10" : "border-line hover:border-line2"
                    } ${!interactive ? "cursor-default" : ""}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === "multi" && (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  disabled={!interactive}
                  onClick={() => interactive && toggleMulti(q.id, opt)}
                  className={`focus-ring w-full text-left text-sm rounded-xl border px-4 py-3 transition ${isSelected(q, opt) ? "border-accent-soft bg-accent-soft/10" : "border-line hover:border-line2"
                    } ${!interactive ? "cursor-default" : ""}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === "scale" && (
            <div className="flex gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  disabled={!interactive}
                  onClick={() => interactive && setAnswer(q.id, opt)}
                  className={`focus-ring flex-1 text-sm font-medium rounded-xl border py-3 transition ${isSelected(q, opt) ? "border-accent-soft bg-accent-soft/10" : "border-line hover:border-line2"
                    } ${!interactive ? "cursor-default" : ""}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === "text" && (
            <textarea
              rows={3}
              readOnly={!interactive}
              value={(interactive && answers?.[q.id]) || ""}
              onChange={(e) => interactive && setAnswer(q.id, e.target.value)}
              placeholder="Type your answer…"
              className="focus-ring w-full bg-panel border border-line rounded-xl px-4 py-3 text-sm placeholder:text-ink/30 resize-none"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Full-page chrome (logo strip, title, progress bar) shared by both the
// live public page and the preview modal.
export function SurveyFormChrome({ survey, answeredCount, children, previewBanner }) {
  return (
    <div className="max-w-xl mx-auto px-6 pt-10 pb-8">
      {previewBanner ? (
        <div className="flex items-center gap-2 mb-6 bg-accent-soft/10 border border-accent-soft/30 text-accent-soft text-xs font-medium rounded-lg px-3 py-2 w-fit">
          <Eye size={13} />
          Preview — responses here aren't recorded
        </div>
      ) : (
        <div className="flex items-center gap-2.5 mb-8">
          <img src="https://res.cloudinary.com/xtydyhi0/image/upload/v1784464670/Asha_Logo_forBlack_mt8s2u.svg" width={"50px"} alt="" />
        </div>
      )}

      <h1 className="text-4xl font-bold mb-5">{survey.title}</h1>
      {survey.description && <p className="text-ink/50 text-sm mb-12">{survey.description}</p>}

      <div className="h-1 bg-panel2 rounded-full mb-10 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${survey.questions.length ? (answeredCount / survey.questions.length) * 100 : 0}%` }}
        />
      </div>

      {children}
    </div>
  );
}

export function SurveyThanksScreen() {
  return (
    <div className="min-h-full flex items-center justify-center px-6 py-24">
      <div className="text-center max-w-sm animate-fadeInUp">
        <div className="w-14 h-14 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={26} className="text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Thanks for your response!</h1>
        <p className="text-ink/40 text-sm mb-10">It's been recorded.</p>

        {/* <div className="rounded-2xl border border-line bg-gradient-to-br from-accent/10 via-accent-soft/5 to-transparent px-6 py-7">
          <img
            src="https://res.cloudinary.com/xtydyhi0/image/upload/v1784464670/Asha_Logo_forBlack_mt8s2u.svg"
            width="36px"
            alt=""
            className="mx-auto mb-4 opacity-90"
          />
          <h2 className="text-base font-bold mb-1.5">Build surveys like this one</h2>
          <p className="text-ink/50 text-sm mb-5">
            This form was built in minutes with Asha — describe what you need, and the AI drafts it for you.
          </p>
          <a
            href="https://asha-surveys.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full rounded-full bg-accent text-white text-sm font-semibold py-3 hover:opacity-90 active:scale-[0.98] transition"
          >
            Try Asha for free
          </a>
        </div> */}
      </div>
    </div>
  );
}
