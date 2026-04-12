# Project: learn-react

## General Instructions

- When you generate new TypeScript code, follow the existing coding style.
- Prefer functional programming paradigms where appropriate.
- Respond and code in English.

## Coding Style

- Use 4 spaces for indentation.
- verbatimModuleSyntax is enabled, so use type-only import when needed.
- erasableSyntaxOnly is enabled.

## Core Philosophy

- Hybrid App: Adopts a "single set of React Web code + native shell" solution, supporting  Web, PC desktop and mobile platforms.
- Local-First: The client possesses complete and independent business logic capabilities. Data is prioritized for storage in a local SQLite database and synchronized to the cloud via an "Action Queue" when network connectivity is restored.
- Separation of Macro and Micro States: Business logic utilizes a unidirectional data flow, while high-frequency 3D rendering uses pointer-level direct connections (to bypass React virtual DOM performance bottlenecks).

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

## Architectural Rules

- Never Pollute the 3D Render Domain: UI components (HTML/DOM) and 3D scenes (WebGL/Canvas) must be absolutely layered via `z-index`. Data communication must go through Zustand or Signals. Writing complex business logic inside 3D components is strictly prohibited.
- Adaptive UI: Writing two sets of project code is strictly prohibited. Presentational Components must be dynamically switched in memory using Tailwind media queries (micro) and the `useIsMobile` Hook (macro).
- Disaster-Proof Sync: Clients are strictly prohibited from executing physical deletions (DELETE). Soft Deletes must be used via `is_deleted` or `deleted_at` flags. Synchronization relies on incremental event replay rather than mindless overwriting.
- Dumb Components (UI Puppetization): shadcn/ui components must remain pure and completely free of business state. All data must be injected into them by the outer Container components.