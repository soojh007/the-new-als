# Adaptive Grammar Studio

A modern adaptive learning prototype for grammar, focused on verbs. It keeps the
OATutor-inspired architecture: content-driven items, skill tags, scaffolded
hints, mastery estimates, and adaptive next-item selection.

## Current Module

Verb tense basics:

- Simple present
- Simple past
- Simple future
- Regular past `-ed`
- Irregular past tense

## What It Demonstrates

- A learner-facing grammar tutor with multiple-choice and typed answers
- A small Bayesian Knowledge Tracing style mastery update per verb skill
- Adaptive item selection based on lowest estimated mastery and difficulty band
- A reusable JSON-like grammar item object with options, answer, hints, and skill tag
- A verbs curriculum map that can later become the teacher authoring structure

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

- Move grammar content into versioned JSON files or a database
- Add a teacher authoring view for verb skills, distractors, hints, and rubrics
- Add misconception tags, such as overusing `-ed` for irregular verbs
- Persist learner sessions and mastery histories
- Add hint-aware BKT so assisted correct answers give smaller mastery gains
