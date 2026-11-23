import type { QuizQuestion } from '@shared-types';

/**
 * The sample folder every new account gets instantly, with no AI generation.
 * It is subject-neutral so it is useful whatever the user wants to study, and
 * it is labelled as a sample that is safe to delete.
 */
export const SAMPLE_LIBRARY_DIRECTORY = {
  name: 'Sample course - How to study effectively',
  description:
    'A short sample course that shows what StudyForge creates. It is safe to delete.',
} as const;

export const SAMPLE_LIBRARY_TAG = 'sample';

export interface ISampleLibraryDocument {
  title: string;
  description: string;
  /** Body HTML fragment; wrapped into a full document on storage. */
  html: string;
}

export const SAMPLE_LIBRARY_DOCUMENTS: readonly ISampleLibraryDocument[] = [
  {
    title: 'Active recall and spaced repetition',
    description: 'Two study techniques with the strongest evidence behind them.',
    html: `<h1>Active recall and spaced repetition</h1>
<p>Most people study by re-reading notes and highlighting. It feels productive, but it builds familiarity rather than memory. Two techniques consistently do better in research: <strong>active recall</strong> and <strong>spaced repetition</strong>.</p>
<h2>Active recall</h2>
<p>Active recall means pulling information out of your memory instead of putting it back in. Every time you retrieve a fact, the memory of it gets stronger and easier to reach next time.</p>
<ul>
<li>Close the book and write down everything you remember about a topic.</li>
<li>Answer quiz questions before you look at the explanation.</li>
<li>Explain the idea out loud, as if teaching a friend.</li>
</ul>
<h2>Spaced repetition</h2>
<p>Forgetting starts within hours of learning something new. Reviewing just before you would forget resets the clock, and each review lets you wait a little longer before the next one.</p>
<ul>
<li>Review new material after one day, then after three days, then after a week.</li>
<li>Spend more time on what you got wrong and less on what you already know.</li>
<li>Keep sessions short and regular rather than long and rare.</li>
</ul>
<h2>Putting them together</h2>
<p>Quizzes and flashcards combine both ideas: each question makes you recall an answer, and returning to them over several days spaces the practice. In StudyForge you can generate a quiz from any document and come back to it later.</p>`,
  },
  {
    title: 'Planning a study session',
    description: 'A simple routine for focused, productive study sessions.',
    html: `<h1>Planning a study session</h1>
<p>A good study session has a clear goal, a fixed length and a short review at the end. Planning takes two minutes and saves far more time than it costs.</p>
<h2>Before you start</h2>
<ul>
<li><strong>Pick one goal.</strong> For example, "understand how photosynthesis produces glucose", not "study biology".</li>
<li><strong>Set a time box.</strong> Twenty-five to fifty minutes works well for most people.</li>
<li><strong>Remove distractions.</strong> Put your phone in another room and close unrelated tabs.</li>
</ul>
<h2>During the session</h2>
<p>Alternate between learning and testing yourself. Read or watch a short section, then close it and recall the key points. If you get stuck, note the question and keep going instead of losing momentum.</p>
<h2>After the session</h2>
<ul>
<li>Write a three-sentence summary of what you learned.</li>
<li>List the questions you could not answer; they are tomorrow's starting point.</li>
<li>Schedule your next review, using spaced repetition.</li>
</ul>
<p>Small, consistent sessions beat occasional marathons. A plan you can repeat every day is worth more than a perfect plan you follow once.</p>`,
  },
];

export const SAMPLE_LIBRARY_QUIZ: {
  title: string;
  questions: QuizQuestion[];
} = {
  title: 'Quiz: How to study effectively',
  questions: [
    {
      question: 'What does active recall mean?',
      options: [
        'Re-reading your notes several times',
        'Pulling information out of memory without looking',
        'Highlighting the most important sentences',
        'Listening to a lecture again',
      ],
      correctAnswer: 1,
      hint: 'It is about retrieving, not reviewing.',
    },
    {
      question: 'Why does spaced repetition work?',
      options: [
        'Reviewing just before you forget strengthens the memory',
        'It lets you study everything in one long session',
        'It avoids testing yourself',
        'It only works for languages',
      ],
      correctAnswer: 0,
      hint: 'Think about the forgetting curve.',
    },
    {
      question: 'Which goal is best for a single study session?',
      options: [
        'Study biology',
        'Finish the whole textbook',
        'Understand how photosynthesis produces glucose',
        'Read for as long as possible',
      ],
      correctAnswer: 2,
      hint: 'A good goal is specific and achievable in one sitting.',
    },
    {
      question: 'What should you do when you get stuck during a session?',
      options: [
        'Stop the session for the day',
        'Note the question and keep going',
        'Start the topic again from the beginning',
        'Switch to a different subject',
      ],
      correctAnswer: 1,
      hint: 'Keep your momentum.',
    },
    {
      question: 'Which review schedule follows spaced repetition?',
      options: [
        'Ten reviews on the same evening',
        'One review a month before the exam',
        'After one day, then three days, then a week',
        'Only when you feel you have forgotten',
      ],
      correctAnswer: 2,
      hint: 'The gaps get longer each time.',
    },
  ],
};
