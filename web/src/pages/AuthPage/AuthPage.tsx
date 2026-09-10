import React from 'react';
import { Bot, Check, ListOrdered, Puzzle } from 'lucide-react';
import { AuthForm } from '../../components/AuthForm';
import { BrandMark } from '../../components/BrandMark';

const workflowTags = [
  'Quizzes',
  'Flashcards',
  'Slide decks',
  'Diagram quizzes',
  'Sequence quizzes',
  'Match quizzes',
  'Agent',
] as const;

const productHighlights = [
  {
    title: 'Sequence quiz',
    description:
      'Shuffle steps, events, or sentences and ask the learner to put them back in the right order.',
    icon: ListOrdered,
  },
  {
    title: 'Match quiz',
    description:
      'Pair prompts with answers: terms to definitions, causes to effects, or any labeled pairing from your sources.',
    icon: Puzzle,
  },
  {
    title: 'Agent',
    description:
      'A workspace agent can search your library and help generate study assets. Open a directory-scoped agent when you want the same tools limited to one directory tree.',
    icon: Bot,
  },
] as const;

const publicPlans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'to start',
    credits: '150 monthly credits',
    storage: '100 MB storage',
    slides: '1 slide deck per day',
    note: 'Default plan on sign-up.',
  },
  {
    name: 'Standard',
    price: '$12',
    cadence: '/ month',
    credits: '2,000 monthly credits',
    storage: '2 GB storage',
    slides: '8 slide decks per day',
    note: 'For regular generation across a growing library.',
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: '/ month',
    credits: '8,000 monthly credits',
    storage: '8 GB storage',
    slides: '25 slide decks per day',
    note: 'For heavier quiz, slide, and agent usage.',
  },
] as const;

export const AuthPage: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at 12% 12%, rgba(124, 58, 237, 0.22), transparent 30%), radial-gradient(circle at 88% 18%, rgba(99, 14, 212, 0.18), transparent 24%), linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 40%)',
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,460px)] lg:items-start">
          <section className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-medium text-primary shadow-[0_12px_40px_rgba(99,14,212,0.18)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card p-2 ring-1 ring-border/50">
                <BrandMark className="h-7 w-7" decorative />
              </div>
              <span className="font-heading text-base tracking-tight">StudyForge</span>
            </div>

            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/80 sm:text-sm">
                Source material, refined
              </p>
              <h1 className="mx-auto max-w-3xl text-balance text-5xl font-bold font-heading tracking-tight text-foreground sm:text-6xl lg:mx-0 lg:text-[4.5rem] lg:leading-[1.02]">
                Forge raw content into polished study systems.
              </h1>
              <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl lg:mx-0">
                StudyForge turns notes, articles, and prompts into quizzes, flashcards,
                slide decks, diagram quizzes, sequence quizzes, and match quizzes. An
                agent can work across your library or inside one directory.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              {workflowTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm text-muted-foreground shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {productHighlights.map((highlight) => {
                const Icon = highlight.icon;
                return (
                  <div
                    key={highlight.title}
                    className="linear-glass rounded-3xl border border-border/40 p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
                      <Icon size={18} aria-hidden />
                    </div>
                    <h2 className="text-xl font-semibold font-heading text-foreground">
                      {highlight.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {highlight.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/80">
                  Pricing
                </p>
                <h2 className="mt-2 text-2xl font-semibold font-heading text-foreground sm:text-3xl">
                  Start free, then add credits when you need them.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  These public monthly prices are listed here for preview. After you
                  sign in, Usage shows the live catalog and checkout.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {publicPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className="linear-glass rounded-3xl border border-border/40 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
                  >
                    <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                    <p className="mt-2 text-3xl font-semibold font-heading text-foreground">
                      {plan.price}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {plan.cadence}
                      </span>
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        {plan.credits}
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        {plan.storage}
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        {plan.slides}
                      </li>
                    </ul>
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">{plan.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="relative pb-8 lg:sticky lg:top-8 lg:self-start">
            <div className="absolute inset-6 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <AuthForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
