import Link from "next/link";

const features = [
  {
    title: "Adaptive Modality Mixer",
    description:
      "Blend audio narration, visual summaries, diagrams, and code-first demos into a single lecture that adjusts to each learner.",
  },
  {
    title: "Instructor + TA Agents",
    description:
      "Pair a lead instructor agent with an attentive teaching assistant that scaffolds comprehension, prompts reflection, and answers follow-ups.",
  },
  {
    title: "Progress-Aware Delivery",
    description:
      "Lectures stream in phases—transcript, slides, diagrams, voiceover—so learners can jump in, pause, or remix on their own schedule.",
  },
];

const useCases = [
  {
    title: "College & Bootcamp Students",
    description:
      "Swap passive lectures for interactive study playlists tailored to the learner’s preferred pace and modality.",
  },
  {
    title: "Professionals Upskilling",
    description:
      "Spin up concise refreshers with walkthroughs, practice prompts, and code-first demos that match real-world workflows.",
  },
  {
    title: "Lifelong Learners",
    description:
      "Explore new topics for fun with visual or audio-first learning paths, guided by an AI duo that keeps curiosity alive.",
  },
];

const deliveryFlow = [
  {
    title: "POST /api/newLecture",
    description:
      "Submit a topic to stitch together transcript, slides, diagrams, and a voiceover pipeline.",
  },
  {
    title: "WS /api/lecture",
    description:
      "Stream progress updates and send interrupts for clarifications—just like raising your hand mid-lecture.",
  },
  {
    title: "GET /api/lecture",
    description:
      "Retrieve every generated asset once complete, then re-sequence or remix to fit the learner’s plan.",
  },
];

export default function Home() {
  return (
    <div className="bg-white text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-24 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-300">
              Personalized lectures, on demand
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Build adaptive lecture experiences that match every learner’s
              brain.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-100/90 sm:text-xl">
              Lecture Gen transforms static syllabi into interactive, multimodal
              journeys. Learners assemble the format they want, while an AI
              instructor + TA duo delivers scaffolding, practice prompts, and
              realtime support.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/lectures"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              Preview the lecture experience
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
            >
              Sign in to craft your flow
            </Link>
          </div>
        </div>
      </section>

      <section
        id="mission"
        className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20"
      >
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold">Our mission</h2>
          <p className="mt-4 text-lg text-slate-600">
            Lecture Gen enables rapid creation of personalized, high-engagement
            lecture formats that adapt to each learner’s preferred modality and
            pacing. We believe every concept is more memorable when it is
            delivered in the language that resonates with the learner.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-slate-50 py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold">From prompt to lecture</h2>
            <p className="mt-4 text-lg text-slate-600">
              The Lecture Gen orchestration loop chains APIs and agent
              workflows, so learners can explore the topic while assets are
              streaming in. Every piece is built for remixing through our
              structured outputs.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {deliveryFlow.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {step.title}
                </p>
                <p className="mt-3 text-sm text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold">Who we serve</h2>
          <p className="mt-4 text-lg text-slate-600">
            Traditional lectures are passive and one-size-fits-all. Lecture Gen
            gives control back to the learner, no matter the setting.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {useCase.title}
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                {useCase.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="sponsor-integrations"
        className="bg-slate-900 py-20 text-white"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold">Tools & integrations</h2>
            <p className="mt-4 text-lg text-slate-200">
              We orchestrate the best media infrastructure and AI diagramming
              tools to deliver lectures that are vivid and responsive.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-lg font-semibold">LiveKit media layer</h3>
              <p className="mt-3 text-sm text-slate-200">
                Powers low-latency audio capture, synthesis, and streaming so
                every learner can jump into an interactive Q&amp;A.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-lg font-semibold">Diagram generation</h3>
              <p className="mt-3 text-sm text-slate-200">
                Blend Google Images, NotesGPT, DiagramGPT, and on-the-fly
                Mermaid rendering to visualize complex concepts instantly.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-lg font-semibold">Sponsor integrations</h3>
              <p className="mt-3 text-sm text-slate-200">
                Check sponsor list!!! Tailor branded learning experiences while
                keeping accessibility at the center.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold">Accessibility matters</h2>
          <p className="mt-4 text-lg text-slate-600">
            Personalized pacing, modality options, and adaptive scaffolding help
            neurodiverse learners and those with limited access to traditional
            instruction stay engaged and absorb material more effectively.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-lg font-medium text-slate-900">
            “Lecture Gen feels like having a professor and TA who already know
            how I learn. I can read, listen, or watch at my pace—and jump back
            in with questions anytime.”
          </p>
          <p className="mt-4 text-sm text-slate-500">
            — Early pilot participant, Accessibility Lab
          </p>
        </div>
      </section>

      <section className="bg-slate-100 py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="text-3xl font-semibold text-slate-900">
            Ready to assemble your first adaptive lecture?
          </h2>
          <p className="max-w-2xl text-lg text-slate-600">
            Start with a topic, choose your preferred modalities, and let our AI
            instructor + TA duo build the experience in real time.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/lectures"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
            >
              Browse lecture templates
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400"
            >
              Sign in to customize
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
