import React, { useMemo } from "react"

/**
 * Generates a CSS clip-path polygon string for a squircle.
 * Using the parametric equation:
 * x(t) = sign(cos(t)) * |cos(t)|^(2/n)
 * y(t) = sign(sin(t)) * |sin(t)|^(2/n)
 */
// eslint-disable-next-line react/only-export-components
export function generateSquirclePolygon(n = 4, points = 64): string {
    const polygon = []
    for (let i = 0; i < points; i++) {
        const t = (i / points) * 2 * Math.PI
        const cosT = Math.cos(t)
        const sinT = Math.sin(t)

        const x = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n)
        const y = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n)

        // Map from [-1, 1] to [0%, 100%]
        const px = (((x + 1) / 2) * 100).toFixed(2) + "%"
        const py = (((y + 1) / 2) * 100).toFixed(2) + "%"
        polygon.push(`${px} ${py}`)
    }
    return `polygon(${polygon.join(", ")})`
}

export interface SquircleProps extends React.HTMLAttributes<HTMLDivElement> {
    n?: number
    points?: number
}

export function Squircle({
    n = 4,
    points = 64,
    children,
    className = "",
    style,
    ...props
}: SquircleProps) {
    const clipPath = useMemo(
        () => generateSquirclePolygon(n, points),
        [n, points]
    )

    return (
        <div
            className={`relative overflow-hidden ${className}`}
            style={{ ...style, clipPath }}
            {...props}
        >
            {children}
        </div>
    )
}
