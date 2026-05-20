import type { IsoDateTime } from "@/shared/models/base.model"

export const BASE_PIXELS_PER_MINUTE = 1
export const TOP_MARGIN = 32
export const BOTTOM_MARGIN = 64

export const getNowISO = (): IsoDateTime => {
    return new Date().toISOString() as IsoDateTime
}

export const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export const timeToISO = (timeStr: string, dateStr?: string): IsoDateTime => {
    const datePart = dateStr || formatLocalDate(new Date())
    const [year, month, day] = datePart.split("-").map(Number)
    const parts = timeStr.split(":").map(Number)
    const hour = parts[0]
    const minute = parts[1]
    const second = parts[2] || 0

    // Create date in local time, then convert to UTC ISO
    const date = new Date(year, month - 1, day, hour, minute, second)
    return date.toISOString() as IsoDateTime
}

export const isoToTime = (isoStr: string, includeSeconds = false): string => {
    const date = new Date(isoStr)
    const h = String(date.getHours()).padStart(2, "0")
    const m = String(date.getMinutes()).padStart(2, "0")
    const s = String(date.getSeconds()).padStart(2, "0")
    return includeSeconds ? `${h}:${m}:${s}` : `${h}:${m}`
}

export const getDurationString = (minutes: number): string => {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h > 0) {
        return `${h}h ${m}m`
    }
    return `${m}m`
}

export const isoToMinutes = (isoStr: string) => {
    const date = new Date(isoStr)
    return date.getHours() * 60 + date.getMinutes()
}

export const isTouchEvent = (
    e: React.MouseEvent | React.TouchEvent
): e is React.TouchEvent => {
    return "touches" in e
}

export const isCardOverlappingDate = (
    startIso: string,
    endIso: string | null,
    currentDate: Date
): boolean => {
    const start = new Date(startIso).getTime()
    const end = endIso ? new Date(endIso).getTime() : new Date().getTime()

    const startOfDay = new Date(currentDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(currentDate)
    endOfDay.setHours(23, 59, 59, 999)

    return start <= endOfDay.getTime() && end > startOfDay.getTime()
}

export const getVisualBoundsForDate = (
    startIso: string,
    endIso: string | null,
    currentDate: Date
) => {
    const start = new Date(startIso).getTime()
    const end = endIso ? new Date(endIso).getTime() : new Date().getTime()

    const startOfDayDate = new Date(currentDate)
    startOfDayDate.setHours(0, 0, 0, 0)
    const startOfDay = startOfDayDate.getTime()

    const endOfDayDate = new Date(currentDate)
    endOfDayDate.setHours(23, 59, 59, 999)
    const endOfDay = endOfDayDate.getTime()

    const visualStart = Math.max(start, startOfDay)
    const visualEnd = Math.min(end, endOfDay + 1) // +1 to treat end as 24:00 if needed

    const startMin = (visualStart - startOfDay) / 60000
    const duration = (visualEnd - visualStart) / 60000

    return {
        startMin,
        duration,
        isStartClamped: start < startOfDay,
        isEndClamped: end > endOfDay,
    }
}

/**
 * HSV Color Utilities
 */

export interface HSV {
    h: number // 0-360
    s: number // 0-100
    v: number // 0-100
}

export const hexToHsv = (hex: string): HSV => {
    // Remove # if present
    hex = hex.replace(/^#/, "")

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    let h = 0
    if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6
        else if (max === g) h = (b - r) / delta + 2
        else h = (r - g) / delta + 4
        h = Math.round(h * 60)
        if (h < 0) h += 360
    }

    const s = max === 0 ? 0 : Math.round((delta / max) * 100)
    const v = Math.round(max * 100)

    return { h, s, v }
}

export const hsvToHex = ({ h, s, v }: HSV): string => {
    s /= 100
    v /= 100

    const c = v * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = v - c

    let r = 0,
        g = 0,
        b = 0
    if (h >= 0 && h < 60) {
        r = c
        g = x
        b = 0
    } else if (h >= 60 && h < 120) {
        r = x
        g = c
        b = 0
    } else if (h >= 120 && h < 180) {
        r = 0
        g = c
        b = x
    } else if (h >= 180 && h < 240) {
        r = 0
        g = x
        b = c
    } else if (h >= 240 && h < 300) {
        r = x
        g = 0
        b = c
    } else if (h >= 300 && h <= 360) {
        r = c
        g = 0
        b = x
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16)
        return hex.length === 1 ? "0" + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * OKLCH Color Utilities
 */

export interface OKLCH {
    l: number // Lightness (0-1)
    c: number // Chroma (0-0.4)
    h: number // Hue (0-360)
}

function srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function rgbToOklab(r: number, g: number, b: number) {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

    const l_ = Math.cbrt(l)
    const m_ = Math.cbrt(m)
    const s_ = Math.cbrt(s)

    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
    const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
    const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

    return { L, a, b: b_ }
}

function oklabToRgb(L: number, a: number, b: number) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b
    const s_ = L - 0.0894841775 * a - 1.291485548 * b

    const l = l_ * l_ * l_
    const m = m_ * m_ * m_
    const s = s_ * s_ * s_

    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699294 * s
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    const b_ = -0.0041960863 * l - 0.7034186148 * m + 1.707614701 * s

    return { r, g, b: b_ }
}

export const hexToOklch = (hex: string): OKLCH => {
    hex = hex.replace(/^#/, "")
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    // To linear sRGB
    const rL = srgbToLinear(r)
    const gL = srgbToLinear(g)
    const bL = srgbToLinear(b)

    // To Oklab
    const lab = rgbToOklab(rL, gL, bL)

    // To Oklch
    const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
    let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI
    if (h < 0) h += 360

    return { l: lab.L, c: C, h }
}

export const oklchToHex = ({ l, c, h }: OKLCH): string => {
    const a = c * Math.cos((h * Math.PI) / 180)
    const b = c * Math.sin((h * Math.PI) / 180)

    // To linear sRGB
    const rgbL = oklabToRgb(l, a, b)

    // To sRGB
    const r = Math.max(0, Math.min(1, linearToSrgb(rgbL.r)))
    const g = Math.max(0, Math.min(1, linearToSrgb(rgbL.g)))
    const bVal = Math.max(0, Math.min(1, linearToSrgb(rgbL.b)))

    const toHex = (n: number) => {
        const hexStr = Math.round(n * 255).toString(16)
        return hexStr.length === 1 ? "0" + hexStr : hexStr
    }

    return `#${toHex(r)}${toHex(g)}${toHex(bVal)}`
}

export const PRESET_COLORS = [
    // 17 chromatically uniform, highly vibrant OKLCH presets (L = 0.66, C = 0.22)
    "#fc4447", // Hue 25: Rose/Danger
    "#f75500", // Hue 46: Orange-Red
    "#e66c00", // Hue 67: Amber/Warning
    "#c88400", // Hue 88: Yellow
    "#9e9900", // Hue 110: Lime
    "#5faa00", // Hue 131: Leaf Green
    "#00b545", // Hue 152: Emerald/Success
    "#00b986", // Hue 173: Teal
    "#00b7ba", // Hue 194: Cyan
    "#00ade6", // Hue 215: Sky
    "#009eff", // Hue 237: Blue
    "#268cff", // Hue 258: Indigo/Brand
    "#7b79ff", // Hue 279: Violet
    "#aa68ff", // Hue 300: Purple
    "#cd58e1", // Hue 321: Fuchsia
    "#e64ab6", // Hue 343: Deep Pink
    "#f74183", // Hue 4: Warm Red

    // 3 premium, brand-harmonized neutrals (L = 0.66, C = 0.04 / 0.05)
    "#8493ab", // Cool Slate Neutral (Hue 260)
    "#a28e78", // Warm Stone Neutral (Hue 70)
    "#7d9b82", // Muted Sage Neutral (Hue 150)
]

export const getTagShades = (baseColor: string): string[] => {
    const oklch = hexToOklch(baseColor)
    const result: string[] = []
    // Generate 10 beautifully spaced, perceptually uniform shades
    for (let i = 0; i < 10; i++) {
        // Lightness ranges smoothly from 0.95 (light pastel) down to 0.35 (deep rich tone)
        const l = 0.95 - i * 0.066
        // Gracefully taper chroma at lightness extremes to stay within sRGB gamut beautifully
        const taper = Math.sin(Math.PI * l)
        const c = oklch.c * (0.3 + 0.7 * taper)
        result.push(oklchToHex({ l, c, h: oklch.h }))
    }
    return result
}

export const resolveTagColor = (colorStr: string): string => {
    if (!colorStr) return "#787878"

    // Check if it matches the format "presetIndex-shadeIndex"
    const match = colorStr.match(/^(\d+)-(\d+)$/)
    if (match) {
        const presetIndex = parseInt(match[1], 10)
        const shadeIndex = parseInt(match[2], 10)

        if (presetIndex >= 0 && presetIndex < PRESET_COLORS.length) {
            const baseColor = PRESET_COLORS[presetIndex]
            const shades = getTagShades(baseColor)
            if (shadeIndex >= 0 && shadeIndex < shades.length) {
                return shades[shadeIndex]
            }
        }
    }

    // Fallback: If it's already a hex color, return it directly
    return colorStr
}

export const findNearestPresetAndShade = (hexColor: string): string => {
    const targetOklch = hexToOklch(hexColor)
    const targetL = targetOklch.l
    const targetA = targetOklch.c * Math.cos((targetOklch.h * Math.PI) / 180)
    const targetB = targetOklch.c * Math.sin((targetOklch.h * Math.PI) / 180)

    let minDistance = Infinity
    let bestPresetIndex = 0
    let bestShadeIndex = 0

    // Loop through all presets and shades to find the nearest Euclidean distance in OKLAB
    for (let p = 0; p < PRESET_COLORS.length; p++) {
        const baseColor = PRESET_COLORS[p]
        const shades = getTagShades(baseColor)
        for (let s = 0; s < shades.length; s++) {
            const shadeHex = shades[s]
            const shadeOklch = hexToOklch(shadeHex)
            const shadeL = shadeOklch.l
            const shadeA =
                shadeOklch.c * Math.cos((shadeOklch.h * Math.PI) / 180)
            const shadeB =
                shadeOklch.c * Math.sin((shadeOklch.h * Math.PI) / 180)

            const dL = targetL - shadeL
            const dA = targetA - shadeA
            const dB = targetB - shadeB
            const distance = Math.sqrt(dL * dL + dA * dA + dB * dB)

            if (distance < minDistance) {
                minDistance = distance
                bestPresetIndex = p
                bestShadeIndex = s
            }
        }
    }

    return `${bestPresetIndex}-${bestShadeIndex}`
}
