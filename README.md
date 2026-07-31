# Adaptive SVA Studio

A modern adaptive learning prototype for Primary 4 subject-verb agreement,
using content extracted from the combined SLS PDF supplied by the user.

The app keeps the OATutor-inspired architecture: content-driven items, skill
tags, scaffolded hints, mastery estimates, and adaptive next-item selection.

## Current Content Source

Source PDF:

```txt
/Users/soojh007/Downloads/subject verb agreement combined.pdf
```

Extracted content lives in:

```txt
content/grammar-sva/
  skills.json
  curriculum.json
  items.json
```

Because no answer key was supplied, item answers are marked with
`answerStatus`. Values such as `inferred` should be teacher-reviewed before
classroom use.

## Curriculum Map

- KU1: What is a subject?
- KU2: Using regular verbs with different subjects
- KU3: Using be verbs with different subjects
- KU4: Using verb phrases with different subjects
- KU5: What types of nouns do subjects have?
- KU6: Subjects with information before the head noun
- KU7: Subjects with information after the head noun
- KU8: Subjects with relative clauses
- KU9: Subjects with and / or

## What It Demonstrates

- A learner-facing SVA tutor with multiple-choice and typed answers
- A small Bayesian Knowledge Tracing style mastery update per SVA skill
- Adaptive item selection based on lowest estimated mastery and difficulty band
- A reusable grammar item bank with PDF source page and answer-review status
- A curriculum map that can later become a teacher authoring structure

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

## Validate

```bash
npm run build
npm test
```

## Next Product Steps

- Review inferred answers against teacher answer keys when available
- Add more extracted items from every KU quiz section
- Add misconception tags, such as nearby-noun confusion or wrong be-verb tense
- Add repeat-aware and hint-aware BKT
- Add a teacher authoring view for skills, distractors, hints, and rubrics
