# The four document types

The four types come from Diátaxis (https://diataxis.fr/). This file states their rules in its own
words. Each section links to the page of its type for the full text.

## The choice of a type

A type serves one need of a reader. Ask what the reader wants to do with the document:

| The reader wants to | The type |
|---|---|
| understand a topic | explanation |
| learn by doing | tutorial |
| do one task | how-to guide |
| look up a fact | reference |

Two questions sort a need when the reader's words do not (https://diataxis.fr/compass/). First:
does the text guide an action, or does it give knowledge? Second: does it serve study, or work?

- An action for study is a tutorial.
- An action for work is a how-to guide.
- Knowledge for work is reference.
- Knowledge for study is explanation.

One document has one type. When a topic needs two types, it gets two documents, and each links to
the other.

## The rules of each document

These rules hold for each type. The section of the type adds its own rules.

- Write each claim only from a source that you read in this run: the code, a record, a document of
  the project, or the output of a step that you ran for a tutorial or a how-to guide. Leave out a
  claim with no source, and name it in the report.
- Write a claim from a run only as far as the run showed it, under the conditions of that run.
  Output that went to a pipe or a file can differ from output in a terminal. Name that condition,
  or leave the claim out. Take the behavior of another tool from a run or from a project source,
  not from general knowledge.
- Take a reason ("why") only from a decision record, a recorded decision, or a document of the
  project.
- Give a structure or a flow that is easier to see than to read a Mermaid diagram: a fenced block
  with the identifier `mermaid`. Each node names a real part. The text stands without the diagram,
  because some viewers show only its source.
- Name files and symbols in code spans, with no line numbers.
- Link to the reference and to the other documents of the set. Copy none of their text.
- Write in the language and the style of the project: its `AGENTS.md` files and its existing
  documents.
- Add no empty section, page, or folder.

## Tutorial

Source: https://diataxis.fr/tutorials/

**Purpose.** A tutorial is a lesson. The reader is new to the product and learns by doing a small
real piece of work from start to end. The aim is the skill and the confidence of the reader, not
the result of the work.

**Form.**

- Start with one sentence that says what the reader will make, and which tools they will meet on
  the way. Do not promise what they will learn.
- Give one path, in small steps. Each step is an action and shows its visible result: the output,
  a file, a changed screen. Show the exact expected output where it helps.
- Tell the reader what to notice after a step, and name the sign that a step went wrong.
- Use "we" for the reader and the text together, and plain imperatives: "Now run …".
- Stay concrete: this command, this file, this result. The general idea comes from the examples.
- Take the shortest route to the end. Leave out options and other ways to do a step.
- End with a short statement of what the reader made.

**Leave out.** The reasons behind a step: give one short clause at most, and link to the
explanation. The full list of options of a command: link to the reference. A task that only a
practiced user needs: that is a how-to guide.

**The rules of this skill.**

- Run each step once, in a temporary folder outside the checkout, before you write it. Use a
  temporary home for each state that the product writes, so that no step touches the real data of
  the person.
- Write the output that the run gave, not the output that you expect.
- When a step cannot run, stop that document. Write no tutorial, and name the step and the cause in
  the report.

## How-to guide

Source: https://diataxis.fr/how-to-guides/

**Purpose.** A how-to guide helps a reader who already knows the product to do one real task. It
starts from the goal of the reader, not from a feature of the product.

**Form.**

- The title says the task exactly: "How to <do the task>".
- Start with the situation and the result: "This guide shows how to …".
- Give the steps in the order that the work needs. A step can be a decision: "If you want x, do y."
- Start and stop at points that make sense for the task. The reader joins the guide to their own
  work, so the guide does not need to cover everything around it.
- Let the guide fit the real cases of the reader. Name a fork when the task has one.

**Leave out.** Teaching: the reader is already competent, and a lesson is a tutorial. Background
and reasons: link to the explanation. Every option of a tool: link to the reference.

**The rules of this skill.**

- Run each step once, in a temporary folder outside the checkout, before you write it. Use a
  temporary home for each state that the product writes, so that no step touches the real data of
  the person.
- Write the output that the run gave, not the output that you expect.
- When a step cannot run, for example because it needs a service or an account that the temporary
  folder does not have, stop that document. Write no guide, and name the step and the cause in the
  report.

## Reference

Source: https://diataxis.fr/reference/

**Purpose.** A reference describes the product: its commands, options, settings, interfaces, file
formats, and limits. The reader consults it during work to get one fact that they can trust.

**Form.**

- Describe, and only describe. State each fact plainly and completely, with no opinion.
- Use one pattern for each kind of entry, so that the reader finds a fact where they expect it.
- Follow the structure of the product: the order and the grouping of the commands, the modules, or
  the fields that it describes.
- Give a short example of use where it makes an entry clear.
- State a warning or a limit where the product has one.

**Leave out.** Steps toward a goal: link to the how-to guide. The reasons behind a design: link to
the explanation.

**The rules of this skill.**

- Take each fact from the source that defines it: the code, the schema, the command help, or the
  contract. A document of the project is a source only when no code defines the fact.
- When the project already generates a reference from its code, link to it, and do not write a
  second copy.

## Explanation

Source: https://diataxis.fr/explanation/

**Purpose.** An explanation helps the reader understand a topic: how its parts fit together, and
why it is as it is. The reader reads it away from the work, to think about the product.

**Form.**

- The title is "About <topic>". The topic has clear limits, often set by one "why" question.
- Give the context: the problem, the constraints, the decisions, and the history that shaped the
  topic.
- Make connections: to the other parts of the product, and to the ideas that a reader already
  knows.
- Name the alternatives that the project considered, and why it chose its way.
- Show how the parts work together, at the level of the topic.

**Leave out.** Steps: link to the how-to guide or the tutorial. Lists of options and fields: link
to the reference. An explanation that takes in these texts hides them from the reader who looks for
them in their own place.

**The rules of this skill.**

- When no record states the reason for a choice, describe what the product does, and leave out the
  reason ("The rules of each document").
- A diagram shows the zoom level of the document (the C4 levels, https://c4model.com/): the
  product and the people and systems around it for the overview, the parts of the product for a
  part, and the components of one part for a topic inside it.

## The overview

The overview is the first explanation document of a product. It answers: what is this product,
what are its parts, and where in the code is each part. Its outline follows the convention of an
`ARCHITECTURE.md` file (https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html) and the lean use
of arc42 (https://docs.arc42.org/home/). It has these five headings, in this order:

1. `## The problem`: what the product does, for whom, and the main idea of its solution.
2. `## The codemap`: the coarse parts of the product and how they relate. For each part, name its
   folders and files, and its main types or entry points, in code spans.
3. `## The invariants`: the rules that hold everywhere, often an absence ("no part writes …").
4. `## The boundaries`: the lines between the layers or the systems, and what crosses each line.
5. `## The cross-cutting concerns`: the matters that touch many parts, for example the
   configuration, the errors, the tests, and the logs.

State only facts that change rarely. Name a file or a symbol, and give no line number and no deep
link into a file: a reader finds the name with a search. Give each other explanation document of
the set one link from the part of the overview that it explains.
