# Project Context

## General Instructions

- **Always use 'bun', not 'npm'.**
- Respond and code in English.

1. Make changes.

2. Typecheck (fast)
bun run typecheck

3. Run tests
bun run test -- -t "test name"  # Single suite

4. Lint
bun run lint                    # All files

5. Dry run build
bun run tsc -p tsconfig.app.json --noEmit && bun run tsc -p tsconfig.node.json --noEmit && bun run tsc -p tsconfig.test.json --noEmit

## TypeScript & Typing Strictness

- **Zero `any` Tolerance:** Under no circumstances should you generate TypeScript code using the `any` type. If type definitions are missing, infer them from the context or ask for the interface.
- **Compiler Rigor:** Treat TypeScript's structural typing with absolute strictness. Do not bypass the compiler.
- **Use `unknown` for Dynamic Data:** If a payload or error object is genuinely unpredictable (e.g., catching an error, parsing raw JSON), type it as `unknown` and write explicit type guards or `typeof` checks to narrow the type before accessing its properties.
- **Leverage Generics:** Use Generics (`<T>`) for flexible functions and interfaces, particularly within the Zustand Action Queue and local-first synchronization pipelines.
- **Supabase Schema Extraction:** Never use arbitrary strings or generic objects for database operations. Always type Supabase calls by extracting the exact definitions from the generated `Database` schema file (e.g., `Database['public']['Tables']['table_name']['Row']`).
- **Compilation Flags:** Strictly adhere to `verbatimModuleSyntax` (enforcing `import type` and `export type` for pure types) and `erasableSyntaxOnly` (avoiding enums and namespaces in favor of union types and const objects).

## Core Philosophy

- Hybrid App: Adopts a "single set of React Web code + native shell" solution, supporting  Web, PC desktop and mobile platforms.
- Local-First: The client possesses complete and independent business logic capabilities. Data is prioritized for storage in a local SQLite database and synchronized to the cloud via an "Action Queue" when network connectivity is restored.
- Separation of Macro and Micro States: Business logic utilizes a unidirectional data flow, while high-frequency 3D rendering uses pointer-level direct connections (to bypass React virtual DOM performance bottlenecks).
- Design: The project is organized into separate modules according to the "Feature-Sliced / Domain-Driven Design" methodology.

## Tech Stack Matrix

- Base Environment: Node.js + Vite + TypeScript (strong type checking).
- UI View Layer: React + Tailwind CSS + shadcn/ui.
- 3D and Visual Engine: Three.js + React Three Fiber (R3F) (used for underlying SDF metaball animations and 3D character display).
- Global State Management (Macro): Zustand for macro business data (RPG logic, quests, levels).
- Global State Management (Micro): Preact Signals (`@preact/signals-react`) for micro high-frequency rendering (UI tracking, mouse movement, 3D coordinates).
- Animation (UI Physics): Framer Motion for physical rebound in UI interactions.
- Animation (Complex/State Machines): Rive for complex micro-animations and state machines.
- Audio System: Howler.js (using packaged audio sprites and native plugins to bypass the iOS mute switch).
- Persistence (Local): SQLite for the local database.
- Persistence (Cloud): Supabase (PostgreSQL + RLS Row Level Security policies) for Cloud sync BaaS.
- Build & Compilation (Desktop): Tauri (Rust underneath) for Mac/Windows.
- Build & Compilation (Mobile): Capacitor for iOS/Android.
- Engineering (Testing/Catalog): Storybook.js for component testing and UI cataloging.
- Engineering (Optimization): Using Vite environment variables (`import.meta.env`) for Tree Shaking and conditional compilation to exclude platform-specific code.
- The default shell is Powershell.

## Architectural Rules

- Never Pollute the 3D Render Domain: UI components (HTML/DOM) and 3D scenes (WebGL/Canvas) must be absolutely layered via `z-index`. Data communication must go through Zustand or Signals. Writing complex business logic inside 3D components is strictly prohibited.
- Adaptive UI: Writing two sets of project code is strictly prohibited. Presentational Components must be dynamically switched in memory using Tailwind media queries (micro) and the `useIsMobile` Hook (macro).
- Disaster-Proof Sync: Clients are strictly prohibited from executing physical deletions (DELETE). Soft Deletes must be used via `is_deleted` or `deleted_at` flags. Synchronization relies on incremental event replay rather than mindless overwriting.
- Dumb Components (UI Puppetization): shadcn/ui components must remain pure and completely free of business state. All data must be injected into them by the outer Container components.
- Follow a feature-based module system (high cohesion) where business domains are isolated into independent functional units.

## Naming Conventions

- For folders, use kebab-case and pluralize when should be.
- For components, use PascalCase for both file name and exported component name.
- For models, use kebab-case.model for file name and PascalCase for exported model name.
- For pure functions and utilities, use kebab-case for file name and camelCase for exported function name.
- For custom hooks and Zustand stores, use kebab-case.store for file name and camelCase (prefixed with `use`) for exported hook or store name.
- For Preact signals, use kebab-case.signal for file name and camelCase (suffixed with `Signal`) for exported signal name.
- For constants, use kebab-case for file name and UPPER_CASE for exported constant name.