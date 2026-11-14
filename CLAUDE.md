# Aeolus self-host: guidelines for Claude Code

## What it is

The supported way to self-host an Aeolus fleet: one Docker Compose stack running core and the console always, and squadrons, the trierarch plugin, the gateway and Postgres as profiles, built from the published npm packages. It sits on top of the dependency graph: it knows every part, nothing depends on it. Aeolus's promises: aeolus-fleet's [blueprint](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/blueprint.md).

## Source of truth

- aeolus-fleet's [docs/guide/self-host.md](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/guide/self-host.md): what a self-hoster runs and installs, and the first sign-in.
- aeolus-fleet's [docs/guide/run-the-server.md](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/guide/run-the-server.md): each part as a service, databases and users, health, upgrade, back up and restore.
- aeolus-fleet's [docs/design/self-hosting-operations.md](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/design/self-hosting-operations.md): the approved decisions behind this repository.
- aeolus-fleet's [blueprint](https://github.com/ThomasHendrickx/aeolus-fleet/blob/main/docs/blueprint.md): product, language, behaviour.

If the docs do not answer a behaviour question, stop and ask. Never decide product behaviour yourself.

## House rules

- npm only (npm install, npm run, npm test). Never pnpm or yarn.
- English for all code, names, comments, commits and paths.
- No em dashes anywhere: code, docs, commits, PR text.
- Use the ubiquitous language from the blueprint (fleet, ship, crew, operator, plugin). Invent no synonyms or new terms.
- `.env.example` is the one place a part's exact version is pinned; everything else reads it.
- Images install the published npm packages, never source from another repository.
- Each part gets its own Postgres LOGIN owner and database.
- A version bump is one thin PR per release.

## Skills

Load the matching skills from `.claude/skills/` (Codex: `.agents/skills/`) before the work they name. They are mandatory, not suggestions:

- `software-development` and `behaviour-driven-development`: every change to the stack, its scripts or its tests.
- `code-review`: reviewing a branch, pull request or diff.
- `pull-request`: writing a pull request body.
- `writing-for-agents`: editing CLAUDE.md, a skill, or a doc agents read.

They come from ThomasHendrickx/skills, pinned in `skills-lock.json`: never edit them here; change them there, tag a release, then `npx skills@1.7.2 add ThomasHendrickx/skills#<tag> --agent claude-code codex -y`.

## Quality

- The checks and both test scenarios (base stack, all profiles) green before every commit; CI runs them on a fresh Linux runner. Push only a green head.
- Report a check or scenario as passing only after you saw it run by name.

## Working

Do what the prompt and the docs ask, nothing more: done means the acceptance criteria are met, and earlier slices are not precedent.

- One slice per session, one PR per slice, kept thin. Commit per logical step, not one catch-up commit.
- A finding that does not block the criteria is not acted on: a real defect is filed as an issue, anything else goes in the PR.
- Repo text must serve the current commit. What git shows (what changed, the steps taken) lives in commits and the PR, never in files.
- New rules, checks, exceptions or process steps come only from Thomas: propose, never add.
- No self-review passes. The one review is a clean-room session after the PR.
