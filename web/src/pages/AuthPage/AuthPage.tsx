import React from 'react';
import { AuthForm } from '../../components/AuthForm';
import { Icon } from '../../components/ui/Icon';
import { MascotImage } from '../../components/MascotImage';

const authHighlights = [
  {
    title: 'One source, many study assets',
    description:
      'Turn the same document set into quizzes, flashcards, slide decks, and diagram challenges.',
    iconPath:
      'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Rules stay in the loop',
    description:
      'Keep directory rules and prompting workflows attached to every generation pass.',
    iconPath:
      'M3 7l9 4 9-4M3 12l9 4 9-4M3 17l9 4 9-4',
  },
  {
    title: 'Built for focused iteration',
    description:
      'Move from raw notes to polished study material without leaving a single workspace.',
    iconPath:
      'M5 13l4 4L19 7M12 21V3',
  },
] as const;

const workflowTags = ['Quizzes', 'Flashcards', 'Slide decks', 'Diagram drills'] as const;

export const AuthPage: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at 12% 12%, rgba(124, 58, 237, 0.22), transparent 30%), radial-gradient(circle at 88% 18%, rgba(99, 14, 212, 0.18), transparent 24%), linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 40%)',
        }}
      />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,460px)] lg:items-center">
          <section className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-3 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-medium text-primary shadow-[0_12px_40px_rgba(99,14,212,0.18)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card/60 ring-1 ring-primary/15 backdrop-blur-sm">
                <MascotImage
                  variant="happy"
                  alt=""
                  className="h-7 w-7"
                />
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
                slide decks, and diagram challenges without breaking your flow.
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
              {authHighlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="linear-glass rounded-3xl border border-border/40 p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
                    <Icon size={18}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={highlight.iconPath}
                      />
                    </Icon>
                  </div>
                  <h2 className="text-xl font-semibold font-heading text-foreground">
                    {highlight.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {highlight.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="linear-glass relative overflow-hidden rounded-[32px] border border-border/40 p-6 text-left shadow-[0_22px_70px_rgba(0,0,0,0.22)]">
              <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 via-transparent to-transparent" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 items-center justify-center rounded-[26px] bg-muted/40 ring-1 ring-border/40">
                  <MascotImage
                    variant="curious"
                    alt="Forge fox mascot"
                    className="h-24 w-24"
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/80">
                    Meet Forge
                  </p>
                  <h2 className="text-2xl font-semibold font-heading text-foreground sm:text-3xl">
                    A focused workspace for building study assets fast.
                  </h2>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Keep documents, rules, and generated outputs in one place, then iterate from
                    prompt to polished artifact without context switching.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="relative">
            <div className="absolute inset-6 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative">
              <AuthForm />
            </div>
          </section>
        </div>
      </div>

      <div className="relative px-6 pb-8 text-center text-sm text-muted-foreground lg:px-10">
        StudyForge keeps documents, rules, and generated learning assets aligned in one place.
      </div>
    </div>
  );
};