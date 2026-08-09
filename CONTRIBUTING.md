# Contributing

Thank you for your interest in contributing to RNBP!

## Getting Started

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Copy environment files: see `apps/api/.env.example` and `apps/web/.env.example`
4. Start Docker (PostgreSQL): `docker start postgres`
5. Start development servers: `pnpm dev:all`

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm lint` to type-check
4. Run `pnpm test` to run tests
5. Commit with a clear, descriptive message in English
6. Open a pull request against `main`

## Code Conventions

- **Language**: Code, comments, commits, and documentation in English
- **UI**: Bilingual French/English (i18n)
- **Framework**: ESM everywhere, TypeScript strict mode
- **Formatting**: Follow `.prettierrc` and `.editorconfig` settings
- **Database**: Schema changes go through Drizzle migrations — never ALTER TABLE directly
- **Components**: Reuse existing components in `components/ui/` before creating new ones
- **Fixed-width i18n**: Interactive elements (buttons, tabs) must have a fixed `minWidth` based on the longer language to prevent layout shifts

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Include a clear description of what changed and why
- Reference related issues if applicable
- Ensure `pnpm lint` and `pnpm test` pass before submitting

## Reporting Issues

Use [GitHub Issues](https://github.com/Alexandre-Lessard/badge-platform/issues) to report bugs or request features.
