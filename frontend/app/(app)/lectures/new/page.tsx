"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type QuestionType = "text" | "textarea" | "choice";

type QuestionOption = {
  value: string;
  label: string;
  description?: string;
};

type Question = {
  id: string;
  label: string;
  helper?: string;
  placeholder?: string;
  type: QuestionType;
  options?: QuestionOption[];
};

type QuestionGroup = {
  id: string;
  title: string;
  description: string;
  questions: Question[];
};

const questionGroups: QuestionGroup[] = [
  {
    id: "topic-blueprint",
    title: "Topic Blueprint",
    description:
      "Give the instructor duo a sense of the lecture’s direction and the moments that must land.",
    questions: [
      {
        id: "lecture-topic",
        label: "What topic should this lecture unpack?",
        type: "text",
        placeholder: "e.g. Gradient descent intuition for product engineers",
      },
      {
        id: "key-takeaways",
        label: "List 3 key takeaways learners should remember.",
        helper: "Bullet points are welcome—pretend the TA is taking notes.",
        type: "textarea",
        placeholder:
          "• Learners can explain the gradient descent update rule\n• …",
      },
    ],
  },
  {
    id: "audience-context",
    title: "Audience & Modality",
    description:
      "Share context about who will listen in, so pacing and scaffolding feel right-sized.",
    questions: [
      {
        id: "audience-profile",
        label: "Who is the primary audience?",
        type: "textarea",
        placeholder:
          "e.g. Bootcamp cohort familiar with JavaScript but new to ML concepts.",
      },
      {
        id: "preferred-delivery",
        label: "Preferred delivery emphasis",
        type: "choice",
        options: [
          {
            value: "visual-heavy",
            label: "Visual heavy",
            description: "Slide-forward with diagram-first explanations.",
          },
          {
            value: "audio-guided",
            label: "Audio guided",
            description: "Narration-led with supporting visuals as needed.",
          },
          {
            value: "code-first",
            label: "Code first",
            description: "Walk through code demos with annotations.",
          },
        ],
      },
      {
        id: "access-needs",
        label: "Any accessibility or pacing needs?",
        type: "textarea",
        placeholder:
          "e.g. Include transcripts, allow frequent pauses, emphasize real-world metaphors…",
      },
    ],
  },
  {
    id: "practice-path",
    title: "Practice Path",
    description:
      "Outline how the TA agent should challenge learners once the concepts land.",
    questions: [
      {
        id: "practice-prompts",
        label: "Describe the kind of practice prompts to include.",
        type: "textarea",
        placeholder:
          "e.g. Two short answer checks + one open-ended synthesis question.",
      },
      {
        id: "confidence-level",
        label: "How confident is the audience on this topic today?",
        type: "choice",
        options: [
          { value: "just-exploring", label: "Just exploring" },
          { value: "some-experience", label: "Some experience" },
          { value: "deep-dive", label: "Ready for a deep dive" },
        ],
      },
    ],
  },
];

type AnswersState = Record<string, string>;

function buildInitialAnswers(groups: QuestionGroup[]): AnswersState {
  return groups.reduce<AnswersState>((acc, group) => {
    group.questions.forEach((question) => {
      acc[question.id] = "";
    });
    return acc;
  }, {});
}

type QuestionFieldProps = {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  isActive: boolean;
};

function QuestionField({
  question,
  value,
  onChange,
  onFocus,
  isActive,
}: QuestionFieldProps) {
  const sharedLabelStyles =
    "flex items-center justify-between text-sm font-medium text-slate-700";

  return (
    <div
      className={`rounded-2xl border p-6 transition ${
        isActive
          ? "border-slate-900 shadow-lg shadow-slate-900/5"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <label htmlFor={question.id} className={sharedLabelStyles}>
        <span>{question.label}</span>
        {question.type !== "choice" && (
          <span className="text-xs font-normal text-slate-400">
            {(value?.length ?? 0) > 0 ? "Captured" : "Pending"}
          </span>
        )}
      </label>
      {question.helper ? (
        <p className="mt-2 text-xs text-slate-500">{question.helper}</p>
      ) : null}

      {question.type === "text" ? (
        <input
          id={question.id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          placeholder={question.placeholder}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      ) : null}

      {question.type === "textarea" ? (
        <textarea
          id={question.id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          placeholder={question.placeholder}
          rows={5}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      ) : null}

      {question.type === "choice" && question.options ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {question.options.map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                onFocus={onFocus}
                className={`flex h-full flex-col rounded-xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
                {option.description ? (
                  <span
                    className={`mt-2 text-xs ${
                      isSelected ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    {option.description}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function LectureConfiguratorPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswersState>(
    () => buildInitialAnswers(questionGroups),
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completionRatio = useMemo(() => {
    const total = Object.keys(answers).length;
    const completed = Object.values(answers).filter((value) => value.trim())
      .length;
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [answers]);

  const updateAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const persistAnswers = (payload: AnswersState) => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const storageKey = `lecture-config-${Date.now()}`;
      const enrichedPayload = {
        answers: payload,
        createdAt: new Date().toISOString(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(enrichedPayload));
      return storageKey;
    } catch (storageError) {
      console.error(storageError);
      return null;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const storageKey = persistAnswers(answers);

    if (!storageKey) {
      setError("We couldn’t prepare your lecture handoff. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push(`/lectures/new/progress?config=${storageKey}`);
  };

  return (
    <div className="bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Lecture Generation
              </p>
              <h1 className="mt-2 text-4xl font-semibold text-slate-900">
                Shape the instructor brief.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600">
                Answer a few prompts so the instructor + TA agents can tune
                pacing, visuals, and practice to your learners. You can adjust
                anything later once assets begin streaming in.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 sm:items-end">
              <span className="uppercase tracking-widest text-slate-400">
                Progress
              </span>
              <span className="text-lg font-semibold text-slate-900">
                {completionRatio}%
              </span>
              <span className="text-xs text-slate-500">
                {completionRatio === 100
                  ? "Ready to handoff."
                  : "Complete the prompts to give agents context."}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-14"
      >
        {questionGroups.map((group) => (
          <section key={group.id} className="space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-slate-900">
                {group.title}
              </h2>
              <p className="max-w-3xl text-sm text-slate-600">
                {group.description}
              </p>
            </div>

            <div className="grid gap-6">
              {group.questions.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => updateAnswer(question.id, value)}
                  onFocus={() => setActiveQuestionId(question.id)}
                  isActive={activeQuestionId === question.id}
                />
              ))}
            </div>
          </section>
        ))}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setAnswers(buildInitialAnswers(questionGroups));
              setActiveQuestionId(null);
            }}
            className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Reset responses
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? "Submitting…" : "Submit & generate lecture"}
          </button>
        </div>
      </form>
    </div>
  );
}
