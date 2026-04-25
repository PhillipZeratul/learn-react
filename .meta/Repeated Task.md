## Turn 1

### 👤 User

What is an industry standard way to implementing a routine planner where the tasks can be repeated every day, every several days, every month or every year

### 🤖 Assistant

As your Chief Architect, I can tell you that handling recurring tasks is notoriously one of the most difficult problems in software engineering. If you try to invent your own custom database columns (`is_daily`, `repeat_days`, `repeat_months`), you will quickly hit a wall when a user asks for "Every 2nd Tuesday of the month."
The undisputed industry standard for implementing recurring events is the **iCalendar Specification (RFC 5545)**, specifically its **RRULE (Recurrence Rule)** component.
Here is the architectural blueprint for implementing this in our Local-First (SQLite + Supabase + React) stack.

### 1. The Core Standard: RRULE Strings
Instead of creating dozens of database columns to represent frequency, you store the repetition logic as a single, standardized string.
Examples of `RRULE` strings:

- **Every day:**`FREQ=DAILY;INTERVAL=1`
- **Every 3 days:**`FREQ=DAILY;INTERVAL=3`
- **Every Monday, Wednesday, Friday:**`FREQ=WEEKLY;BYDAY=MO,WE,FR`
- **Every month on the 15th:**`FREQ=MONTHLY;BYMONTHDAY=15`
In our TypeScript environment, we will use the industry-standard library **rrule.js** to parse these strings and calculate future dates mathematically on the client side.

### 2. The Database Schema (The "Base & Exception" Pattern)
The biggest mistake developers make is trying to write an infinite number of future database records when a user creates a daily task. **Do not do this.** Instead, we use the "Base & Exception" pattern. You store the *blueprint* of the rule, and only write new database records if the user *deviates* from the rule (e.g., changing the time for just one specific day, or completing/skipping a day).

#### Table 1: The Base Entity
Update your `routine_cards` table to hold the RRULE and an anchor date.

```sql
ALTER TABLE public.routine_cards ADD COLUMN rrule TEXT; -- e.g., 'FREQ=DAILY'
ALTER TABLE public.routine_cards ADD COLUMN dtstart TIMESTAMPTZ; -- The very first time it happens

```

#### Table 2: The Exceptions & Completions
Because our app needs to track if a user actually *completed* a routine on a specific day, we need a table to store instances.

```sql
CREATE TABLE public.routine_completions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    routine_card_id UUID REFERENCES public.routine_cards(id),
    recurrence_id TIMESTAMPTZ NOT NULL, -- The specific date/time this instance was supposed to occur
    status TEXT NOT NULL, -- 'completed', 'skipped'
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Crucial: A user can only complete a specific instance of a routine once
CREATE UNIQUE INDEX idx_routine_completion_unique ON public.routine_completions(routine_card_id, recurrence_id) WHERE deleted_at IS NULL;

```

### 3. The Implementation (Client-Side Expansion)
Because of our **Local-First** architecture, your React view layer is responsible for calculating what the user should see today. The Supabase cloud and local SQLite database only hold the rules; the client expands them.
Here is how you handle this in your Business Logic layer:

```typescript
// src/entities/routine-card/model/routine-expansion.ts
import { RRule, rrulestr } from 'rrule';
import type { RoutineCard } from './routine-card.model';

export interface RoutineInstance {
    routineId: string;
    title: string;
    scheduledFor: Date;       // The exact date this instance occurs
    isCompleted: boolean;     // Merged from your routine_completions store
}

/**
 * Expands a single routine's RRULE into a list of occurrences within a timeframe.
 */
export const getRoutineInstancesForDateRange = (
    card: RoutineCard, 
    startDate: Date, 
    endDate: Date,
    completions: RoutineCompletion[] // Passed from Zustand
): RoutineInstance[] => {
    
    // 1. If it doesn't repeat, just check if it falls in the range
    if (!card.rrule) {
        const dtstart = new Date(card.dtstart);
        if (dtstart >= startDate && dtstart <= endDate) {
            return [{
                routineId: card.id,
                title: card.title,
                scheduledFor: dtstart,
                isCompleted: completions.some(c => c.routineId === card.id)
            }];
        }
        return [];
    }

    // 2. Parse the industry-standard RRULE
    const rule = rrulestr(card.rrule, { forceset: true });
    
    // 3. Get all mathematical occurrences between our view dates
    const occurrences = rule.between(startDate, endDate, true);

    // 4. Map them to your UI instances, checking against the exceptions/completions table
    return occurrences.map(occurrenceDate => {
        const isCompleted = completions.some(c => 
            c.routineId === card.id && 
            new Date(c.recurrenceId).getTime() === occurrenceDate.getTime()
        );

        return {
            routineId: card.id,
            title: card.title,
            scheduledFor: occurrenceDate,
            isCompleted
        };
    });
};

```

### 4. How this flows in your Architecture

1. **Creation:** User creates "Morning Jog" every Mon/Wed/Fri. You save ONE `RoutineCard` to SQLite with `rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'`.
2. **Rendering:** When the user opens the "Today" view, your Zustand store pulls the cards, runs `rrule.between(startOfDay, endOfDay)`, and dynamically generates the UI card for today.
3. **Action:** User clicks "Complete" on today's UI card.
4. **Storage:** You create ONE `RoutineCompletion` record locally with `recurrence_id: '2023-10-25T08:00:00Z'` and push it to the Supabase Action Queue.
This approach requires minimal storage, prevents database bloat, and gives you infinite future calendaring for free.
Will you need to allow users to modify the *details* of a single occurrence (e.g., "Change this specific Tuesday's jog from 30 minutes to 45 minutes"), or will they only be able to mark them as completed/skipped?

## Turn 2

### 👤 User

They will be able to modify the details of a single occurrence

### 🤖 Assistant

As your Chief Architect, I must warn you: allowing users to modify a single occurrence of a recurring rule is the "final boss" of calendar application design. It breaks the simple mathematical model of the `RRULE` because you now have human-defined exceptions mixed in with mathematically generated dates.
To solve this in our **Local-First** architecture without duplicating massive amounts of data, we will use the industry-standard **"Detached Instance" (or Exception) Pattern**.
Here is exactly how you implement it.

### 1. The Architectural Pattern: Detached Instances
When a user edits a single occurrence (e.g., changing tomorrow's 30-minute jog to a 45-minute sprint), you **do not** modify the original recurring `RoutineCard`.
Instead, you create a **brand new**`RoutineCard` in the database. This new card acts as an "override." It contains the new 45-minute duration, but it also carries two special relational flags linking it back to the exact occurrence it is overriding.

### 2. The Database Schema Update
We need to add two columns to your existing `routine_cards` table to support these overrides.

```sql
-- 1. Link back to the master recurring card
ALTER TABLE public.routine_cards 
ADD COLUMN parent_routine_id UUID REFERENCES public.routine_cards(id) DEFAULT NULL;

-- 2. Identify EXACTLY which mathematical occurrence this is replacing
ALTER TABLE public.routine_cards 
ADD COLUMN original_recurrence_date TIMESTAMPTZ DEFAULT NULL; 

```
**The "Soft Delete" Superpower:** Because we already enforce soft deletions (`is_deleted = true`), if a user wants to "Delete just this Tuesday's jog," you simply create an override `RoutineCard` for that Tuesday and instantly mark it as `is_deleted = true`. The client will see the override, see it is deleted, and hide it from the UI.

### 3. The Client-Side Expansion Logic (The Merge)
Your React client now has a slightly more complex job. When it looks at "Today," it must generate the mathematical dates, and then **layer the exceptions on top**, replacing the generated dates with the user's manual overrides.
Here is the functional, pure logic for your FSD `model` layer:

```typescript
// src/entities/routine-card/model/routine-expansion.ts
import { rrulestr } from 'rrule';
import type { RoutineCard } from './routine-card.model';

export const getRoutineInstancesForDateRange = (
    masterCard: RoutineCard,
    allCards: RoutineCard[], // Pass in all cards from Zustand
    startDate: Date,
    endDate: Date
): RoutineCard[] => {
    
    // 1. Find all overrides (exceptions) for this specific master card
    const exceptions = allCards.filter(c => c.parentRoutineId === masterCard.id);
    
    // 2. Parse the rule and get mathematical dates
    const rule = rrulestr(masterCard.rrule!, { forceset: true });
    const occurrences = rule.between(startDate, endDate, true);

    const instancesToRender: RoutineCard[] = [];

    for (const occurrenceDate of occurrences) {
        // 3. Check if there is an override for this specific date
        const occurrenceIso = occurrenceDate.toISOString();
        const override = exceptions.find(e => e.originalRecurrenceDate === occurrenceIso);

        if (override) {
            // If the user "deleted" this single occurrence, skip it entirely
            if (override.deletedAt || override.isDeleted) {
                continue; 
            }
            // Otherwise, render the override card instead of the mathematical one
            instancesToRender.push(override);
        } else {
            // 4. No override exists. Generate a "Virtual" card for the UI to render.
            // Notice we do NOT save this to the database. It only exists in memory.
            instancesToRender.push({
                ...masterCard,
                id: `${masterCard.id}-${occurrenceIso}`, // Temporary UI key
                startAt: occurrenceIso, 
                // Note: You would need a helper here to adjust the endAt time
                // based on the duration of the master card.
                isVirtual: true, 
            });
        }
    }

    return instancesToRender;
};

```

### 4. The Workflow in Action
Let's trace a user modifying a single day:

1. **The Setup:** The user has a "Morning Jog" `RoutineCard` (ID: `A1`) repeating daily at 8:00 AM.
2. **The Render:** The `getRoutineInstancesForDateRange` function mathematically generates a virtual card for tomorrow at 8:00 AM.
3. **The Edit:** The user clicks tomorrow's virtual card in the UI and changes the title to "Long Morning Jog" and the time to 7:00 AM. They click "Save for this occurrence only."
4. **The Save:** Your FSD Action creates a **new**`RoutineCard` (ID: `B2`).
  - `title`: "Long Morning Jog"
  - `startAt`: 7:00 AM
  - `rrule`: `null` (this override does not repeat)
  - `parentRoutineId`: `A1`
  - `originalRecurrenceDate`: Tomorrow at 8:00 AM (the time it *was* supposed to happen).
5. **The Sync:** This new `B2` card is saved to the local SQLite DB and pushed to the Supabase Action Queue.
6. **The Re-render:** The function runs again. It generates tomorrow at 8:00 AM, sees the `B2` override matching that exact date, discards the virtual card, and renders `B2` instead.
This architecture protects your database from ballooning with millions of redundant daily records, keeps your Supabase sync lean, and handles edits, deletions, and completions of single occurrences perfectly.