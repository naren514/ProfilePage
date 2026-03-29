# Contributing to ProfilePage

Thank you for your interest in contributing to ProfilePage! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ProfilePage.git
   cd ProfilePage
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up your environment:
   ```bash
   cp .env.example .env.local
   # Fill in your values (see README.md for detailed setup)
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```

## Development Workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Run linting:
   ```bash
   npm run lint
   ```
4. Test your build:
   ```bash
   npm run build
   ```
5. Commit your changes with a descriptive message
6. Push to your fork and open a Pull Request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what the PR does and why
- Make sure `npm run build` passes before submitting
- Update documentation if your change affects setup or usage
- Add screenshots for UI changes

## Project Structure

See the [README](README.md#project-structure) for an overview of the codebase.

Key directories:
- `src/app/` - Next.js pages and API routes
- `src/components/` - React components
- `src/lib/` - Shared utilities (database, AI, auth)
- `scripts/` - Development utility scripts

## Code Style

- TypeScript for all source files
- Follow existing patterns in the codebase
- Use Drizzle ORM for database queries
- Use Zod for input validation on API routes
- Use shadcn/ui components for the UI

## Reporting Issues

- Use [GitHub Issues](https://github.com/YOUR_USERNAME/ProfilePage/issues) to report bugs
- Include steps to reproduce, expected behavior, and actual behavior
- Include your Node.js version and OS

## Questions?

Open a [discussion](https://github.com/YOUR_USERNAME/ProfilePage/discussions) or an issue if you have questions about contributing.
