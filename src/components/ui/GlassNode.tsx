import { useEffect, useId, useState, useMemo } from "react"
import { useGlass } from "./GlassContext"
import { generateSquirclePolygon } from "./Squircle"

export interface GlassNodeProps {
    lensW: number
    lensH: number
    n?: number
    bevelWidth?: number
    distortionIntensity?: number
    x: number
    y: number
}

export function GlassNode({
    lensW,
    lensH,
    n = 4,
    bevelWidth = 0.3,
    distortionIntensity = 1.0,
    x,
    y,
}: GlassNodeProps) {
    const id = useId().replace(/:/g, "-")
    const glassCtx = useGlass()
    const [mapUrl, setMapUrl] = useState<string | null>(null)

    // Generate normal map on resize
    useEffect(() => {
        const canvas = document.createElement("canvas")
        canvas.width = lensW
        canvas.height = lensH
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        ctx.clearRect(0, 0, lensW, lensH)

        const imgData = ctx.getImageData(0, 0, lensW, lensH)
        const data = imgData.data

        const cx = lensW / 2
        const cy = lensH / 2
        const rX = lensW / 2
        const rY = lensH / 2

        const smoothstep = (edge0: number, edge1: number, x: number) => {
            const t = Math.max(
                0.0,
                Math.min(1.0, (x - edge0) / (edge1 - edge0))
            )
            return t * t * (3.0 - 2.0 * t)
        }

        for (let py = 0; py < lensH; py++) {
            for (let px = 0; px < lensW; px++) {
                const dx = (px - cx) / rX
                const dy = (py - cy) / rY

                // sdSquircle distance logic
                const sum =
                    Math.pow(Math.abs(dx), n) + Math.pow(Math.abs(dy), n)
                const dist = Math.pow(sum, 1.0 / n)

                if (dist <= 1.0) {
                    let gradX = 0
                    let gradY = 0

                    if (sum > 0) {
                        const sumPow = Math.pow(sum, 1.0 / n - 1.0)
                        gradX =
                            Math.sign(dx) *
                            Math.pow(Math.abs(dx), n - 1.0) *
                            sumPow
                        gradY =
                            Math.sign(dy) *
                            Math.pow(Math.abs(dy), n - 1.0) *
                            sumPow
                    }

                    // Compute Bevel
                    // SDF is negative inside, 0 at edge.
                    const sdf = dist - 1.0
                    // bevelAmount: 0 in the flat center, ramps to 1 at the edge.
                    const bevelAmount = smoothstep(-bevelWidth, 0.0, sdf)

                    const nx = gradX * bevelAmount
                    const ny = gradY * bevelAmount
                    const nz = 1.0 - bevelAmount * 0.5

                    // Normalize the 3D normal vector
                    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
                    // Invert normal direction for convex magnifying effect,
                    // and scale by distortionIntensity for linear control.
                    const normX = -(nx / len) * distortionIntensity
                    const normY = -(ny / len) * distortionIntensity

                    const r = Math.round((normX + 1) * 127.5)
                    const g = Math.round((normY + 1) * 127.5)

                    const idx = (py * lensW + px) * 4
                    data[idx] = r
                    data[idx + 1] = g
                    data[idx + 2] = 0
                    data[idx + 3] = 255
                }
            }
        }
        ctx.putImageData(imgData, 0, 0)
        setMapUrl(canvas.toDataURL("image/png"))
    }, [lensW, lensH, n, bevelWidth, distortionIntensity])

    // Register with provider when map changes
    useEffect(() => {
        if (!glassCtx || !mapUrl) return

        glassCtx.registerNode({
            id,
            mapUrl,
            lensW,
            lensH,
        })

        return () => {
            glassCtx.unregisterNode(id)
        }
    }, [mapUrl, id, lensW, lensH, glassCtx]) // Notice `x` and `y` are intentionally omitted here to prevent React re-renders

    // DOM-Direct Animation for highly performant 60fps tracking
    useEffect(() => {
        const feImg = document.getElementById(`glass-map-${id}`)
        if (feImg) {
            feImg.setAttribute("x", x.toString())
            feImg.setAttribute("y", y.toString())
        }
    }, [x, y, id])

    const clipPath = useMemo(() => generateSquirclePolygon(n, 64), [n])

    // Render nothing if map isn't ready
    if (!mapUrl) return null

    return (
        <div
            style={{
                position: "absolute",
                top: y,
                left: x,
                width: lensW,
                height: lensH,
                clipPath,
                pointerEvents: "none",
                background:
                    "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.1) 100%)",
                zIndex: 50,
            }}
        />
    )
}
