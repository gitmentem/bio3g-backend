# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Node.js 20+ Fastify backend written in TypeScript. Runtime source lives in `src/`: `server.ts` starts the service, `app.ts` builds the Fastify instance, `config/` validates environment variables, `db/` contains MySQL pool setup, `plugins/` contains Fastify plugins, and `types/` holds shared declarations. Tests live in `test/**/*.test.ts`. Build output is written to `dist/` and should be treated as generated. The `APIs/` directory contains legacy PHP endpoints; avoid changing them unless the task targets that surface.

## Build, Test, and Development Commands

- `npm run dev`: run the TypeScript server with `tsx watch src/server.ts`.
- `npm run build`: compile production JavaScript to `dist/` using `tsconfig.build.json`.
- `npm start`: run the compiled server from `dist/server.js`.
- `npm run lint`: run ESLint across the repository.
- `npm run typecheck`: run TypeScript checks without emitting files.

Run `npm install` first if dependencies are missing.

## Coding Style & Naming Conventions

Use TypeScript ESM imports with explicit `.js` extensions for local modules, matching the existing `NodeNext` configuration. Keep strict typing enabled and prefer Zod schemas for runtime validation. Follow the existing two-space indentation style. Use `camelCase` for variables and functions, `PascalCase` for types/interfaces, and kebab-style names for plugin files such as `auth-jwt.ts`. ESLint is configured with `@eslint/js`, `typescript-eslint`, and Prettier compatibility; unused variables are warnings when intentionally prefixed with `_`.

## Testing Guidelines

No test runner is currently configured. When tests are reintroduced, prefer Fastify `app.inject()` for route tests so tests do not bind network ports. Provide complete test environment values through `loadEnv()` and close Fastify instances in teardown. Add tests when changing request handling, plugin behavior, response envelopes, authentication, or environment validation.

## Commit & Pull Request Guidelines

Git history is not available in this checkout, so use concise imperative commit messages such as `Add auth routes` or `Fix site login validation`. Pull requests should describe the change, mention environment or database impact, link related issues, and include commands run, especially `npm run lint`, `npm run typecheck`, and `npm run build`.

## Security & Configuration Tips

Use `.env.example` as the configuration template. Required values include MySQL connection settings, `JWT_SECRET`, and `DEVICE_API_KEY`. Do not commit real secrets, local `.env` files, database dumps, or generated credentials.
