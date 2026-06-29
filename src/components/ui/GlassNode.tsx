import { useEffect, useId, useState } from "react"
import { useGlass } from "./GlassContext"

export interface GlassNodeProps {
    lensW: number
    lensH: number
    lensBorderRadius?: number
    x: number
    y: number
}

export function GlassNode({
    lensW,
    lensH,
    lensBorderRadius = 0,
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

        for (let py = 0; py < lensH; py++) {
            for (let px = 0; px < lensW; px++) {
                const dx = (px - cx) / rX
                const dy = (py - cy) / rY
                const dist2 = dx * dx + dy * dy

                if (dist2 <= 1) {
                    const r = Math.round((dx + 1) * 127.5)
                    const g = Math.round((dy + 1) * 127.5)

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
    }, [lensW, lensH])

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
                borderRadius: lensBorderRadius || lensW / 2,
                border: "1px solid rgba(255, 255, 255, 0.4)",
                boxShadow:
                    "inset 0 4px 10px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.1)",
                pointerEvents: "none",
                background:
                    "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.1) 100%)",
                zIndex: 50,
            }}
        />
    )
}
