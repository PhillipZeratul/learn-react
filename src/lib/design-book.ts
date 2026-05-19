import {
    DesignBook,
    color,
    ref,
    rem,
    Renderer,
    bestContrastWith,
} from "design-book"

const book = new DesignBook("learn-react")

// ---- values (atoms) ---------------------------------------------------
const values = book.addScope("values")

// Neutrals
values.set("white", color("oklch(1 0 0)"))
values.set("ink", color("oklch(0.147 0.004 49.3)"))
values.set("paper", color("oklch(0.986 0.002 67.8)"))
values.set("slate-100", color("oklch(0.967 0.001 286.375)"))
values.set("slate-200", color("oklch(0.922 0.005 34.3)"))
values.set("slate-300", color("oklch(0.714 0.014 41.2)"))
values.set("slate-400", color("oklch(0.547 0.021 43.1)"))
values.set("slate-800", color("oklch(0.214 0.009 43.1)"))
values.set("slate-900", color("oklch(0.21 0.006 285.885)"))

// Brand / Primary
values.set("blue-500", color("oklch(0.5 0.134 242.749)"))
values.set("blue-600", color("oklch(0.443 0.11 240.79)"))
values.set("blue-light", color("oklch(0.977 0.013 236.62)"))
values.set("blue-sidebar", color("oklch(0.588 0.158 241.966)"))
values.set("blue-sidebar-dark", color("oklch(0.685 0.169 237.323)"))
values.set("blue-sidebar-fg-dark", color("oklch(0.293 0.066 243.157)"))

// Accents / Feedback
values.set("muted", color("oklch(0.96 0.002 17.2)"))
values.set("muted-dark", color("oklch(0.268 0.011 36.5)"))
values.set("red-500", color("oklch(0.577 0.245 27.325)"))
values.set("red-600", color("oklch(0.704 0.191 22.216)"))

// Charts
values.set("chart-1", color("oklch(0.808 0.114 19.571)"))
values.set("chart-2", color("oklch(0.637 0.237 25.331)"))
values.set("chart-3", color("oklch(0.577 0.245 27.325)"))
values.set("chart-4", color("oklch(0.505 0.213 27.518)"))
values.set("chart-5", color("oklch(0.444 0.177 26.899)"))

// ---- light (default) --------------------------------------------------
const light = book.addScope("light")

light.set("background", ref("values.white"))
light.set("foreground", ref("values.ink"))

light.set("card", ref("values.white"))
light.set("card-foreground", ref("values.ink"))

light.set("popover", ref("values.white"))
light.set("popover-foreground", ref("values.ink"))

light.set("primary", ref("values.blue-500"))
light.set("primary-foreground", bestContrastWith(ref("light.primary"), values))

light.set("secondary", ref("values.slate-100"))
light.set("secondary-foreground", ref("values.slate-900"))

light.set("muted", ref("values.muted"))
light.set("muted-foreground", ref("values.slate-400"))

light.set("accent", ref("values.muted"))
light.set("accent-foreground", ref("values.slate-800"))

light.set("destructive", ref("values.red-500"))

light.set("border", ref("values.slate-200"))
light.set("input", ref("values.slate-200"))
light.set("ring", ref("values.slate-300"))

light.set("chart-1", ref("values.chart-1"))
light.set("chart-2", ref("values.chart-2"))
light.set("chart-3", ref("values.chart-3"))
light.set("chart-4", ref("values.chart-4"))
light.set("chart-5", ref("values.chart-5"))

light.set("radius", rem(0.875))

light.set("sidebar", ref("values.paper"))
light.set("sidebar-foreground", ref("values.ink"))
light.set("sidebar-primary", ref("values.blue-sidebar"))
light.set("sidebar-primary-foreground", ref("values.blue-light"))
light.set("sidebar-accent", ref("values.muted"))
light.set("sidebar-accent-foreground", ref("values.slate-800"))
light.set("sidebar-border", ref("values.slate-200"))
light.set("sidebar-ring", ref("values.slate-300"))

// ---- dark -------------------------------------------------------------
const dark = book.addScope("dark", { extends: "light" })

dark.set("background", ref("values.ink"))
dark.set("foreground", ref("values.paper"))

dark.set("card", ref("values.slate-800"))
dark.set("card-foreground", ref("values.paper"))

dark.set("popover", ref("values.slate-800"))
dark.set("popover-foreground", ref("values.paper"))

dark.set("primary", ref("values.blue-600"))
// primary-foreground is inherited but will re-evaluate against dark primary

dark.set("secondary", color("oklch(0.274 0.006 286.033)"))
dark.set("secondary-foreground", color("oklch(0.985 0 0)"))

dark.set("muted", ref("values.muted-dark"))
dark.set("muted-foreground", ref("values.slate-300"))

dark.set("accent", ref("values.muted-dark"))
dark.set("accent-foreground", ref("values.paper"))

dark.set("destructive", ref("values.red-600"))

dark.set("border", color("oklch(1 0 0 / 10%)"))
dark.set("input", color("oklch(1 0 0 / 15%)"))
dark.set("ring", ref("values.slate-400"))

dark.set("sidebar", ref("values.slate-800"))
dark.set("sidebar-foreground", ref("values.paper"))
dark.set("sidebar-primary", ref("values.blue-sidebar-dark"))
dark.set("sidebar-primary-foreground", ref("values.blue-sidebar-fg-dark"))
dark.set("sidebar-accent", ref("values.muted-dark"))
dark.set("sidebar-accent-foreground", ref("values.paper"))
dark.set("sidebar-border", color("oklch(1 0 0 / 10%)"))
dark.set("sidebar-ring", ref("values.slate-400"))

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
