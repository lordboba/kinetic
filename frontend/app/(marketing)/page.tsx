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
      "Creates a new lecture item and starts by asking clarification questions before the lecture is generated.",
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
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-24 sm:py-28">
          <div className="max-w-2xl">
            
            <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-9xl">
              Meet Blazz.
            </h1>
            <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-white sm:text-2xl">
              Your study companion, powered by AI.
            </p>
            <p className="mt-2 text-lg leading-relaxed text-slate-100/90 sm:text-xl">
              
              Personalized lectures that adapt to how you learn—perfect for review, 
catching up, or mastering tough concepts.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold !text-primary border border-transparent transition hover:!border-white hover:!bg-transparent hover:!text-white"
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
                Mermaid diagrams so visuals stay in sync with the lesson arc.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-lg font-semibold">Structured outputs</h3>
              <p className="mt-3 text-sm text-slate-200">
                Every asset is generated with rich metadata so you can remix,
                reorder, or export the lecture to your LMS.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
