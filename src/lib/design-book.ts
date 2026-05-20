import {
    DesignBook,
    color,
    ref,
    rem,
    Renderer,
    bestContrastWith,
    minContrastWith,
    colorMix,
} from "design-book"

const book = new DesignBook("learn-react")

// ---- values (atoms) ---------------------------------------------------
const values = book.addScope("values")

// Neutrals (Slate-like cool neutrals)
values.set("neutral-50", color("oklch(0.98 0.005 260)"))
values.set("neutral-100", color("oklch(0.96 0.008 260)"))
values.set("neutral-200", color("oklch(0.90 0.012 260)"))
values.set("neutral-300", color("oklch(0.81 0.016 260)"))
values.set("neutral-400", color("oklch(0.68 0.020 260)"))
values.set("neutral-500", color("oklch(0.53 0.022 260)"))
values.set("neutral-600", color("oklch(0.40 0.020 260)"))
values.set("neutral-700", color("oklch(0.29 0.016 260)"))
values.set("neutral-800", color("oklch(0.20 0.012 260)"))
values.set("neutral-900", color("oklch(0.14 0.008 260)"))
values.set("neutral-950", color("oklch(0.08 0.005 260)"))

// Brand (Vibrant Indigo-Violet for gamified daily life)
values.set("brand-50", color("oklch(0.96 0.02 260)"))
values.set("brand-100", color("oklch(0.91 0.05 260)"))
values.set("brand-200", color("oklch(0.83 0.09 260)"))
values.set("brand-300", color("oklch(0.73 0.14 260)"))
values.set("brand-400", color("oklch(0.63 0.18 260)"))
values.set("brand-500", color("oklch(0.53 0.21 260)"))
values.set("brand-600", color("oklch(0.44 0.19 260)"))
values.set("brand-700", color("oklch(0.36 0.15 260)"))
values.set("brand-800", color("oklch(0.27 0.11 260)"))
values.set("brand-900", color("oklch(0.18 0.07 260)"))

// Success / Reward (Vibrant Emerald)
values.set("success-50", color("oklch(0.97 0.02 150)"))
values.set("success-100", color("oklch(0.93 0.04 150)"))
values.set("success-200", color("oklch(0.86 0.08 150)"))
values.set("success-300", color("oklch(0.77 0.12 150)"))
values.set("success-400", color("oklch(0.67 0.15 150)"))
values.set("success-500", color("oklch(0.57 0.17 150)"))
values.set("success-600", color("oklch(0.47 0.14 150)"))
values.set("success-700", color("oklch(0.38 0.11 150)"))
values.set("success-800", color("oklch(0.29 0.08 150)"))
values.set("success-900", color("oklch(0.20 0.05 150)"))

// Warning / Gold Coins / Streaks (Vibrant Amber)
values.set("warning-50", color("oklch(0.98 0.02 70)"))
values.set("warning-100", color("oklch(0.94 0.04 70)"))
values.set("warning-200", color("oklch(0.88 0.08 70)"))
values.set("warning-300", color("oklch(0.80 0.12 70)"))
values.set("warning-400", color("oklch(0.71 0.16 70)"))
values.set("warning-500", color("oklch(0.62 0.18 70)"))
values.set("warning-600", color("oklch(0.52 0.15 70)"))
values.set("warning-700", color("oklch(0.42 0.12 70)"))
values.set("warning-800", color("oklch(0.32 0.09 70)"))
values.set("warning-900", color("oklch(0.22 0.06 70)"))

// Danger / Urgent / Missed (Vibrant Rose Red)
values.set("danger-50", color("oklch(0.96 0.02 25)"))
values.set("danger-100", color("oklch(0.91 0.05 25)"))
values.set("danger-200", color("oklch(0.83 0.10 25)"))
values.set("danger-300", color("oklch(0.74 0.15 25)"))
values.set("danger-400", color("oklch(0.64 0.19 25)"))
values.set("danger-500", color("oklch(0.54 0.22 25)"))
values.set("danger-600", color("oklch(0.45 0.19 25)"))
values.set("danger-700", color("oklch(0.36 0.15 25)"))
values.set("danger-800", color("oklch(0.27 0.11 25)"))
values.set("danger-900", color("oklch(0.18 0.07 25)"))

// Charts (Perceptually balanced hues at constant L=0.65)
values.set("chart-1", color("oklch(0.65 0.18 60)"))
values.set("chart-2", color("oklch(0.65 0.16 140)"))
values.set("chart-3", color("oklch(0.65 0.14 200)"))
values.set("chart-4", color("oklch(0.65 0.17 260)"))
values.set("chart-5", color("oklch(0.65 0.20 330)"))

// ---- light (default) --------------------------------------------------
const light = book.addScope("light")

light.set("background", ref("values.neutral-50"))
light.set("foreground", ref("values.neutral-900"))

light.set("card", ref("values.neutral-50"))
light.set("card-foreground", ref("values.neutral-900"))

light.set("popover", ref("values.neutral-50"))
light.set("popover-foreground", ref("values.neutral-900"))

light.set("primary", ref("values.brand-500"))
light.set("primary-foreground", bestContrastWith(ref("light.primary"), values))

light.set("secondary", ref("values.neutral-100"))
light.set(
    "secondary-foreground",
    bestContrastWith(ref("light.secondary"), values)
)

light.set("muted", ref("values.neutral-100"))
light.set("muted-foreground", ref("values.neutral-500"))

light.set(
    "accent",
    colorMix(ref("light.background"), ref("light.primary"), { ratio: 0.08 })
)
light.set("accent-foreground", ref("values.brand-700"))

light.set("destructive", ref("values.danger-500"))

light.set(
    "border",
    minContrastWith(ref("light.background"), values, { ratio: 1.2 })
)
light.set(
    "input",
    minContrastWith(ref("light.background"), values, { ratio: 1.25 })
)
light.set(
    "ring",
    colorMix(ref("light.background"), ref("light.primary"), { ratio: 0.3 })
)

light.set("chart-1", ref("values.chart-1"))
light.set("chart-2", ref("values.chart-2"))
light.set("chart-3", ref("values.chart-3"))
light.set("chart-4", ref("values.chart-4"))
light.set("chart-5", ref("values.chart-5"))

light.set("radius", rem(0.875))

light.set("sidebar", ref("values.neutral-50"))
light.set("sidebar-foreground", ref("values.neutral-900"))
light.set("sidebar-primary", ref("values.brand-500"))
light.set(
    "sidebar-primary-foreground",
    bestContrastWith(ref("light.sidebar-primary"), values)
)
light.set(
    "sidebar-accent",
    colorMix(ref("light.sidebar"), ref("light.sidebar-primary"), {
        ratio: 0.08,
    })
)
light.set("sidebar-accent-foreground", ref("values.brand-700"))
light.set("sidebar-border", ref("values.neutral-200"))
light.set("sidebar-ring", ref("values.brand-300"))

// ---- dark -------------------------------------------------------------
const dark = book.addScope("dark", { extends: "light" })

dark.set("background", ref("values.neutral-950"))
dark.set("foreground", ref("values.neutral-100"))

dark.set("card", ref("values.neutral-900"))
dark.set("card-foreground", ref("values.neutral-100"))

dark.set("popover", ref("values.neutral-900"))
dark.set("popover-foreground", ref("values.neutral-100"))

dark.set("primary", ref("values.brand-600"))
dark.set("primary-foreground", bestContrastWith(ref("dark.primary"), values))

dark.set("secondary", ref("values.neutral-800"))
dark.set(
    "secondary-foreground",
    bestContrastWith(ref("dark.secondary"), values)
)

dark.set("muted", ref("values.neutral-900"))
dark.set("muted-foreground", ref("values.neutral-400"))

dark.set(
    "accent",
    colorMix(ref("dark.background"), ref("dark.primary"), { ratio: 0.12 })
)
dark.set("accent-foreground", ref("values.brand-200"))

dark.set("destructive", ref("values.danger-600"))

dark.set("border", ref("values.neutral-700"))
dark.set("input", ref("values.neutral-700"))
dark.set("ring", ref("values.brand-400"))

dark.set("sidebar", ref("values.neutral-900"))
dark.set("sidebar-foreground", ref("values.neutral-100"))
dark.set("sidebar-primary", ref("values.brand-600"))
dark.set(
    "sidebar-primary-foreground",
    bestContrastWith(ref("dark.sidebar-primary"), values)
)
dark.set(
    "sidebar-accent",
    colorMix(ref("dark.sidebar"), ref("dark.sidebar-primary"), { ratio: 0.12 })
)
dark.set("sidebar-accent-foreground", ref("values.brand-200"))
dark.set("sidebar-border", ref("values.neutral-700"))
dark.set("sidebar-ring", ref("values.brand-400"))

export { book }

export function generateCSS() {
    const css = new Renderer(book, "css-variables").render()

    const lines = css
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("--"))

    // 1. Keep values exactly as they are (including --values- prefix)
    const valuesVars = lines.filter((l) => l.startsWith("--values-")).join("\n")

    // 2. Extract semantic vars and strip the scope prefix (light- or dark-)
    const extractSemantic = (scopeName: string) => {
        return lines
            .filter((l) => l.startsWith(`--${scopeName}-`))
            .map((l) => l.replace(`--${scopeName}-`, "--"))
            .join("\n")
    }

    return {
        values: valuesVars,
        light: extractSemantic("light"),
        dark: extractSemantic("dark"),
    }
}
