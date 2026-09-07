/* ═══════════════════════════════════════════════════════════════════
   HOW IT WORKS — guide content for the 4 Mentor AI functionalities.

   Pure content, no UI — read by HowItWorks.jsx's HowItWorksModal. Keys
   match the module's real screens 1:1: 'chat' (AI Chat Assistant),
   'lessonPlans' + 'notebookPlans' (both live inside the single Lesson
   Plans tab — see LessonPlans.jsx's class → scan → content-type
   funnel, which is exactly why their guides are grouped together
   behind one button with an internal tab switch), 'worksheets',
   'designStudio'.

   This is an explanatory layer only — it describes the current mock
   workflow AND the intended ERP-connected behavior (e.g. "class/unit
   data comes from the school's ERP Academics") so the copy stays
   accurate once that wiring lands, without needing another content
   rewrite. No functionality, API, or workflow is changed by this file.
   ═══════════════════════════════════════════════════════════════════ */

export const HOW_IT_WORKS = {
  chat: {
    icon: 'fa-comments',
    title: 'AI Chat Assistant',
    description: 'Your general-purpose Mentor AI conversation — ask questions, get advice, and pick a specialist mode for more focused help.',
    steps: [
      { icon: 'fa-comment-dots', title: 'Start a Conversation', text: 'Open AI Chat Assistant — you land straight in a fresh conversation, ready to type.' },
      { icon: 'fa-keyboard', title: 'Ask Mentor AI', text: 'Type your question, request, problem, or instruction. Mentor AI replies according to the mode you\'ve selected (tap the mode chip to switch — Science, Grammar, Math and more each answer differently).' },
      { icon: 'fa-image', title: 'Upload Images or Reference Material', text: 'Use the attach button to upload a photo or PDF when you want Mentor AI to look at visual or reference material. Each uploaded image counts toward your school\'s Screens / Scans allowance in the Wallet.' },
      { icon: 'fa-arrows-rotate', title: 'Continue the Conversation', text: 'Keep asking follow-up questions in the same thread — Mentor AI remembers the context of your conversation.' },
      { icon: 'fa-clock-rotate-left', title: 'Chat History', text: 'Every conversation is saved automatically. Open the history panel to revisit an old chat and pick up exactly where you left off.' },
      { icon: 'fa-bolt', title: 'AI Usage', text: 'Chatting and generating content both draw from your school\'s Mentor AI token balance — check the Wallet any time to see what\'s left.' },
    ],
  },

  lessonPlans: {
    icon: 'fa-chalkboard-user',
    title: 'Lesson Plans',
    description: 'Generate complete, textbook-aligned lesson plans in minutes, then save them straight into your school\'s academic workflow.',
    steps: [
      { icon: 'fa-chalkboard-user', title: 'Select Class, Section & Subject', text: 'Choose the class, section and subject you\'re planning for. These come from the same academic data as the rest of the ERP, so everything stays in one ecosystem.' },
      { icon: 'fa-book-open', title: 'Provide Book Reference', text: 'Upload the actual textbook pages you\'re teaching from — one image, several pages, or a scanned PDF (e.g. all 12 pages of a unit). Mentor AI uses these as the reference source, whatever the publisher, so the generated content matches your real textbook — and you can add more pages any time.' },
      { icon: 'fa-list-check', title: 'Choose What to Generate', text: 'Pick Lesson Plans or Notebook Plans. This guide continues with Lesson Plans — see the separate Notebook Plans guide for that path.' },
      { icon: 'fa-layer-group', title: 'Select Unit', text: 'Units already configured in ERP Academics show up here automatically. If a unit doesn\'t exist yet, you can create it (number + name) right from Mentor AI — it becomes available in ERP Academics too once connected, e.g. "Unit 1 — Introduction to Plants."' },
      { icon: 'fa-sliders', title: 'Configure Lesson Plans', text: 'Set how many lesson plans you need, the duration of each (e.g. 40 minutes), and any additional instructions — e.g. "Focus on student participation and practical examples."' },
      { icon: 'fa-wand-magic-sparkles', title: 'Generate', text: 'Mentor AI generates the lesson plans using your class, section, subject, unit, uploaded textbook pages, and instructions together.' },
      { icon: 'fa-file-lines', title: 'Review Generated Lesson Plans', text: 'If you asked for 3 lesson plans, all 3 are ready to review — each structured into sections like Learning Objectives (SLOs), Bloom\'s Taxonomy, Introduction, Development, Activities, Recap and Consolidation.' },
      { icon: 'fa-pen-to-square', title: 'Review / Edit with Mentor AI', text: 'Open any lesson plan to review it, edit the text directly, or use "Edit via Mentor AI" to describe a change and have it regenerated for you.' },
      { icon: 'fa-floppy-disk', title: 'Save to Portal', text: 'Happy with it? Tap "Save to Portal" — the lesson plan is saved against the selected class, section, subject and unit, and becomes part of the school\'s academic workflow.' },
    ],
  },

  notebookPlans: {
    icon: 'fa-pen-ruler',
    title: 'Notebook Plans',
    description: 'Part of the same Lesson Plans workflow — generate notebook exercises (word work, MCQs, comprehension, essays and more) aligned to your textbook.',
    steps: [
      { icon: 'fa-chalkboard-user', title: 'Select Class, Section & Subject', text: 'Same academic data as the rest of the ERP — choose the class, section and subject.' },
      { icon: 'fa-book-open', title: 'Upload Book Reference', text: 'Upload the relevant textbook pages, images or a PDF. Mentor AI uses these pages as its reference for the content it generates.' },
      { icon: 'fa-layer-group', title: 'Select Unit', text: 'Pick from units already in ERP Academics, or create a new one — it follows the same unit structure as Lesson Plans.' },
      { icon: 'fa-list-ul', title: 'Select Notebook Question Type', text: 'Choose from 18 types: Word Opposites, Synonyms, Word Sentences, MCQs, Circle the Correct Word, Singular/Plural, Punctuation, Comprehension, Paragraph Writing, Fill in the Blanks, True/False, Match the Columns, Short Questions, Long Questions, Letters, Applications, Stories and Essays.' },
      { icon: 'fa-hashtag', title: 'Select Number of Items', text: 'Tell Mentor AI how many items to generate (not needed for single-piece types like Letters or Essays).' },
      { icon: 'fa-circle-question', title: 'Provide Main Question / Content Requirement', text: 'Describe what you want, e.g. "Create 10 synonym questions from this unit."' },
      { icon: 'fa-comment-dots', title: 'Add AI Instructions', text: 'Add any extra instructions to fine-tune the result.' },
      { icon: 'fa-wand-magic-sparkles', title: 'Generate', text: 'Mentor AI generates the requested content, including answers where applicable.' },
      { icon: 'fa-pen-to-square', title: 'Review / Edit', text: 'Review the generated notebook plan, edit it manually, or use "Edit via Mentor AI" for AI-assisted changes.' },
      { icon: 'fa-floppy-disk', title: 'Save', text: 'Save the final notebook plan against the selected class, section, subject and unit.' },
    ],
  },

  worksheets: {
    icon: 'fa-file-pen',
    title: 'Worksheets',
    description: 'Create branded, print-ready worksheets in your school\'s chosen style, then save the finished set to your Library.',
    steps: [
      { icon: 'fa-chalkboard-user', title: 'Select Class, Section & Subject', text: 'Choose from the school\'s ERP academic data, same as everywhere else in Mentor AI.' },
      { icon: 'fa-shapes', title: 'Select Worksheet Type', text: 'Pick the kind of worksheet you need — Practice, Assessment, Homework or Enrichment.' },
      { icon: 'fa-gauge', title: 'Select Difficulty', text: 'Choose Easy, Medium or Hard to match the level you\'re teaching to.' },
      { icon: 'fa-font', title: 'Choose Worksheet Format', text: 'Text Only, or Text + Pictures if you want supporting imagery on the page.' },
      { icon: 'fa-palette', title: 'Choose Visual Style', text: 'Colourful or Black & White — whichever suits your printing setup.' },
      { icon: 'fa-file', title: 'Select Worksheet Length', text: 'Set the number of pages you need generated.' },
      { icon: 'fa-school', title: 'School Branding', text: 'Toggle whether the worksheet includes your school name and logo.' },
      { icon: 'fa-comment-dots', title: 'Add Instructions', text: 'Tell Mentor AI what the worksheet should focus on.' },
      { icon: 'fa-image', title: 'Reference Images', text: 'Optionally attach reference pictures so Mentor AI better understands the content or style you want.' },
      { icon: 'fa-wand-magic-sparkles', title: 'Generate Worksheet', text: 'Mentor AI builds the worksheet from your class, subject, type, difficulty, format, style, length, branding and any reference images.' },
      { icon: 'fa-eye', title: 'Review', text: 'Preview the generated pages exactly as they\'ll print, and use "Edit via AI" for any changes.' },
      { icon: 'fa-bookmark', title: 'Save to Library', text: 'Tap "Save to Library" to keep the finished worksheet in your Mentor AI Library for later use.' },
    ],
  },

  designStudio: {
    icon: 'fa-palette',
    title: 'Design Studio',
    description: 'Generate branded social posts and announcements for your school in minutes, ready to download or refine further.',
    steps: [
      { icon: 'fa-expand', title: 'Select Design Type / Size', text: 'Choose a platform size — Instagram, Facebook, LinkedIn, YouTube Thumbnail, X/Twitter — or set a custom size.' },
      { icon: 'fa-tags', title: 'Select Purpose / Category', text: 'Pick what the post is for: Admission Open, Staff/Job Advertisement, Event/News, Result/Award, Course/Programme, Timetable, or Others.' },
      { icon: 'fa-comment-dots', title: 'Enter AI Prompt', text: 'Describe the post you want, e.g. "Create an Admissions Open poster for our school."' },
      { icon: 'fa-swatchbook', title: 'Brand Colors', text: 'Mentor AI uses your school\'s default brand colors — customize them whenever a design calls for something different.' },
      { icon: 'fa-school', title: 'School Information', text: 'Toggle Logo, Name, Contact Number and Address on or off depending on what this design needs.' },
      { icon: 'fa-image', title: 'Attach Reference Photos', text: 'Attach photos or images to guide the visual direction Mentor AI should follow.' },
      { icon: 'fa-wand-magic-sparkles', title: 'Generate Design', text: 'Mentor AI creates the design from your design type, purpose, prompt, brand colors, school information and reference photos together.' },
      { icon: 'fa-pen-to-square', title: 'Edit via Mentor AI', text: 'Ask for changes in plain language — change the headline, layout, tone, colors, image, or the information shown.' },
      { icon: 'fa-bookmark', title: 'Save to Library', text: 'Tap "Save to Library" to keep the finished design in your Mentor AI Library.' },
    ],
  },
};
