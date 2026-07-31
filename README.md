# Adaptive Algebra Studio

A modern adaptive learning prototype inspired by OATutor's core architecture:
content-driven problems, skill tags, scaffolded hints, mastery estimates, and
adaptive next-problem selection.

## What It Demonstrates

- A learner-facing tutor surface with answer checking and progressive hints
- A small Bayesian Knowledge Tracing style mastery update per skill
- Adaptive problem selection based on the lowest-confidence skill
- A reusable JSON-like content object for problems, answers, hints, and skills
- Learning-event logging that shows how student actions change the model

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

- Move lesson content into versioned JSON files or a database
- Add an authoring interface for skills, problems, hints, and rubrics
- Persist learner sessions and mastery histories
- Add richer answer evaluators for algebraic equivalence
- Expand the adaptive policy beyond weakest-skill selection
