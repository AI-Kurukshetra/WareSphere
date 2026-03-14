# Repository Guidelines

## Project Structure & Module Organization
This repository is currently a clean root workspace with no committed source tree yet. Keep application code under `src/`, tests under `tests/`, static assets under `assets/`, and developer scripts under `scripts/` as the project is introduced. Store project documentation in `docs/` and keep root-level files limited to configuration, lockfiles, and onboarding docs such as this guide.

## Build, Test, and Development Commands
No build system is configured yet. When tooling is added, expose a small, predictable command set and document it in `README.md`.

Examples to adopt:
- `make dev` or `npm run dev`: start the local development workflow
- `make test` or `npm test`: run the full automated test suite
- `make lint` or `npm run lint`: run formatting and static analysis

Prefer a single entry point per task so contributors do not need to remember tool-specific flags.

## Coding Style & Naming Conventions
Use 4 spaces for Python and 2 spaces for JavaScript, TypeScript, JSON, YAML, and Markdown. Name files and directories in `kebab-case`, Python modules in `snake_case`, classes in `PascalCase`, and functions or variables in the language’s standard local style. Keep modules focused, avoid large utility dumps, and wire formatters or linters into the default test command as soon as they exist.

## Testing Guidelines
Testing is not configured yet, so add tests with any new feature rather than deferring coverage. Mirror source paths under `tests/` where practical, and use clear names such as `test_auth_flow.py` or `user-profile.test.ts`. Keep fast unit tests in the default suite and separate slower integration or end-to-end tests behind an explicit command.

## Commit & Pull Request Guidelines
There is no visible git history in this workspace, so use short imperative commit subjects such as `Add initial API client` or `Document local setup`. Keep commits scoped to one change. Pull requests should include a concise description, testing notes, linked issues when relevant, and screenshots or sample output for UI or CLI changes.

## Configuration & Security
Do not commit secrets, personal datasets, or generated credentials. Keep local overrides in ignored files such as `.env.local`, and provide a checked-in `.env.example` whenever runtime configuration is required.
