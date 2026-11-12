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

const cardClassName =
  'rounded-2xl border border-border/60 bg-card p-5 text-left';

export const AuthPage: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-background text-foreground">
      <header className="mx-auto flex h-14 w-full max-w-7xl items-center px-6 lg:px-10">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" decorative />
          <span className="text-base font-semibold tracking-tight">
            StudyForge
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-6 pb-16 pt-8 lg:px-10 lg:pt-14">
        <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,460px)] lg:items-start">
          <section className="space-y-10 text-center lg:text-left">
            <div className="space-y-5">
              <p className="text-sm font-medium text-primary">
                Source material, refined
              </p>
              <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:mx-0 lg:text-6xl lg:leading-[1.05]">
                Forge raw content into polished study systems.
              </h1>
              <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground lg:mx-0">
                StudyForge turns notes, articles, and prompts into quizzes,
                flashcards, slide decks, diagram quizzes, sequence quizzes, and
                match quizzes. An agent can work across your library or inside
                one directory.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {workflowTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-4 py-2 text-sm text-foreground/80"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {productHighlights.map((highlight) => {
                const Icon = highlight.icon;
                return (
                  <div key={highlight.title} className={cardClassName}>
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon size={18} aria-hidden />
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {highlight.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {highlight.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-5 text-left">
              <div>
                <p className="text-sm font-medium text-primary">Pricing</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Start free, then add credits when you need them.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  These public monthly prices are listed here for preview. After
                  you sign in, Usage shows the live catalog and checkout.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {publicPlans.map((plan) => (
                  <div key={plan.name} className={cardClassName}>
                    <p className="text-sm font-medium text-muted-foreground">
                      {plan.name}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {plan.price}
                      <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">
                        {plan.cadence}
                      </span>
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {[plan.credits, plan.storage, plan.slides].map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                            aria-hidden
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">
                      {plan.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="pb-8 lg:sticky lg:top-8 lg:self-start">
            <AuthForm />
          </section>
        </div>
      </div>
    </div>
  );
};
