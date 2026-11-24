import type { QuizQuestion } from '@shared-types';

/**
 * The sample folder every new account gets instantly, with no AI generation.
 * It is a short guided tour of StudyForge itself, so it is useful whatever the
 * user wants to study, and it is labelled as safe to delete. Keep the labels
 * in these documents in step with the web app's buttons and menus.
 */
export const SAMPLE_LIBRARY_DIRECTORY = {
  name: 'Start here - Tour of StudyForge',
  description:
    'Three short guides and a quiz that show how StudyForge works. It is safe to delete.',
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
    title: '1. How StudyForge works',
    description: 'The idea in one page: sources in, study materials out.',
    html: `<h1>How StudyForge works</h1>
<p>Welcome! This folder is a short tour. Read the three guides in order, then take the quiz in this folder to try the quiz player. When you are done, you can delete the whole folder.</p>
<h2>The idea in one sentence</h2>
<p>You bring the material you want to learn, StudyForge turns it into study materials, and you practise until it sticks.</p>
<h2>The building blocks</h2>
<ul>
<li><strong>Folders</strong> organise your <strong>Library</strong>. Make one folder per subject or course, and subfolders for topics.</li>
<li><strong>Sources</strong> are the documents in a folder: your notes, a PDF, a web page, a YouTube video or a document the AI writes for you.</li>
<li><strong>Study materials</strong> are generated from sources: quizzes, flashcards, slide decks, diagram quizzes, sequence quizzes and match quizzes.</li>
<li><strong>Rules</strong> are instructions attached to a folder, such as "write for a complete beginner" or "always include worked examples". Every generation in that folder follows them.</li>
<li><strong>The agent</strong> is an assistant that can do all of this for you from a plain-language request.</li>
</ul>
<h2>Finding your way around</h2>
<p>The sidebar on the left takes you to the main areas:</p>
<ul>
<li><strong>Dashboard</strong>: your starting point.</li>
<li><strong>Library</strong>: all your folders and documents.</li>
<li><strong>Progress</strong>: how your quizzes are going and which questions to revisit.</li>
<li><strong>Rules</strong>: create and manage your rules.</li>
<li><strong>Usage &amp; plan</strong>: your monthly credits and what your plan includes.</li>
</ul>
<h2>A typical study loop</h2>
<ol>
<li>Create a folder for the subject.</li>
<li>Add sources to it.</li>
<li>Generate a quiz or other study material from those sources.</li>
<li>Study, then check <strong>Progress</strong> and revisit what you missed.</li>
</ol>
<p>The next guide shows how to add sources and generate study materials.</p>`,
  },
  {
    title: '2. Add sources and create study materials',
    description: 'Upload, paste, link or generate a source, then turn it into a quiz.',
    html: `<h1>Add sources and create study materials</h1>
<p>Everything in StudyForge starts from a source. This guide shows how to add one and how to turn it into study materials.</p>
<h2>Create a folder</h2>
<p>Open the <strong>Library</strong> and create a folder for your subject. Inside a folder, <strong>New subfolder</strong> adds a topic below it. Each subfolder's menu lets you edit, move or delete it, or manage its rules.</p>
<h2>Add a source</h2>
<p>Open a folder and click <strong>Add source</strong>. Choose how the content comes in:</p>
<ul>
<li><strong>File Upload</strong>: upload files such as PDFs or notes.</li>
<li><strong>Paste Text</strong>: paste text you already have.</li>
<li><strong>Website URL</strong>: import a web page, a YouTube video or another link.</li>
<li><strong>AI Prompt</strong>: describe what you want to learn and the AI writes a document for you.</li>
</ul>
<h2>Generate study materials</h2>
<p>There are three ways to start, and they all open the same form:</p>
<ol>
<li>In a folder, use the <strong>Generate</strong> menu on a source and pick a kind, for example <strong>Quiz</strong>.</li>
<li>In a folder, open a tab in the left rail (Quizzes, Cards, Slides and so on) and click the create button, for example <strong>Create quiz</strong>.</li>
<li>While reading a document, open <strong>Actions</strong> at the top and choose, for example, <strong>Create Quiz</strong>.</li>
</ol>
<p>In the form you can name the result, choose one or more <strong>Source documents</strong>, pick <strong>Generation rules</strong> and add your own instructions. The form shows what it costs in credits before you confirm. Generation runs in the background, so you can keep working while it finishes.</p>
<h2>What you can create</h2>
<ul>
<li><strong>Quiz</strong>: multiple-choice questions with hints.</li>
<li><strong>Flashcards</strong>: cards you mark as learned or failed, then retake the failed ones.</li>
<li><strong>Slide deck</strong>: a presentation of the source.</li>
<li><strong>Diagram, sequence and match quizzes</strong>: label a diagram, put steps in order, or match pairs.</li>
</ul>
<p>Some kinds depend on your plan. <strong>Usage &amp; plan</strong> shows what yours includes and how many credits you have left this month.</p>`,
  },
  {
    title: '3. Study, track progress and ask the agent',
    description: 'Practise inside documents, take quizzes, use Progress and the agent.',
    html: `<h1>Study, track progress and ask the agent</h1>
<p>Reading is not the same as learning. StudyForge is built around testing yourself, because pulling an answer out of memory is what makes it stick.</p>
<h2>Practise while you read</h2>
<p>Documents have a <strong>Scratchpad</strong> under their sections. It asks you a question about that section. Use <strong>Reveal</strong> to think of the answer and then show it, or <strong>Type</strong> to write your answer and click <strong>Check</strong>. If you are stuck, use the hint, or ask for a different question.</p>
<p>At the top of a document, <strong>Show TOC</strong> opens the table of contents, and <strong>Export</strong> downloads the document as Markdown or PDF.</p>
<h2>Take a quiz</h2>
<p>Open a quiz and click <strong>Start Quiz</strong>. Each question has a hint if you need it, and you see straight away whether you were right. At the end you get your score, accuracy and time, and you can review your answers or take the quiz again. Try it now with the quiz in this folder.</p>
<h2>Check your progress</h2>
<p><strong>Progress</strong> in the sidebar shows your answer accuracy and lists the questions you got wrong. Revisit those first: practising what you missed is the fastest way to improve. Once you know a question, remove it from the list.</p>
<h2>Ask the agent</h2>
<p>The round button at the bottom right opens the agent. Ask it in plain language, for example:</p>
<ul>
<li>"Create a study folder on the French Revolution with a summary document."</li>
<li>"Summarize this document."</li>
<li>"Create a quiz from this document."</li>
</ul>
<p>It can create folders and documents, generate quizzes and flashcards, find things in your library and set up rules. It may ask a few questions first so the result fits you. It never deletes anything without asking you to confirm.</p>
<h2>Shape the output with rules</h2>
<p>To make everything in a folder follow the same instructions, create a rule on the <strong>Rules</strong> page, then open the folder's rules and click <strong>Assign Rule</strong>. Rules on a folder also apply to its subfolders.</p>
<p>You are ready. Take the quiz in this folder, then start on your own subject.</p>`,
  },
];

export const SAMPLE_LIBRARY_QUIZ: {
  title: string;
  questions: QuizQuestion[];
} = {
  title: 'Quiz: Tour of StudyForge',
  questions: [
    {
      question: 'In StudyForge, what is a source?',
      options: [
        'A quiz you have already taken',
        'A document in a folder that study materials are generated from',
        'A rule that controls how the AI writes',
        'Your monthly credit allowance',
      ],
      correctAnswer: 1,
      hint: 'Study materials are generated from these.',
    },
    {
      question: 'You found a useful YouTube video. How do you add it to a folder?',
      options: [
        'Add source, then Website URL',
        'Add source, then Paste Text',
        'Create quiz, then Source documents',
        'Rules, then Create Rule',
      ],
      correctAnswer: 0,
      hint: 'A video has a link.',
    },
    {
      question: 'Where can you start creating a quiz while reading a document?',
      options: [
        'Show TOC',
        'Export',
        'The Actions menu at the top of the document',
        'The Scratchpad',
      ],
      correctAnswer: 2,
      hint: 'Look at the buttons next to Export.',
    },
    {
      question: 'You want every document in a folder written for complete beginners. What should you use?',
      options: [
        'A rule assigned to the folder',
        'A new subfolder',
        'The Export menu',
        'The Progress page',
      ],
      correctAnswer: 0,
      hint: 'It applies to every generation in the folder and its subfolders.',
    },
    {
      question: 'Where do you see the questions you got wrong?',
      options: [
        'Usage & plan',
        'Progress',
        'Settings',
        'The Library',
      ],
      correctAnswer: 1,
      hint: 'It is in the sidebar and tracks how your quizzes are going.',
    },
    {
      question: 'What does the agent do before deleting anything?',
      options: [
        'Nothing, it deletes straight away',
        'It moves the items to a Trash folder',
        'It asks you to confirm',
        'It exports them as PDF first',
      ],
      correctAnswer: 2,
      hint: 'You stay in control of deletes.',
    },
  ],
};
