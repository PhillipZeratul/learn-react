import React, { useState, useId, useCallback, useMemo } from "react"
import { GlassContext, type GlassNodeData } from "./GlassContext"

export interface GlassProviderProps {
    scale?: number
    children?: React.ReactNode
    className?: string
}

export function GlassProvider({
    scale = 40,
    children,
    className = "",
}: GlassProviderProps) {
    const filterId = useId().replace(/:/g, "-")
    const [nodes, setNodes] = useState<Record<string, GlassNodeData>>({})

    const registerNode = useCallback((node: GlassNodeData) => {
        setNodes((prev) => ({ ...prev, [node.id]: node }))
    }, [])

    const unregisterNode = useCallback((id: string) => {
        setNodes((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
        })
    }, [])

    const contextValue = useMemo(
        () => ({ registerNode, unregisterNode }),
        [registerNode, unregisterNode]
    )

    const nodeList = Object.values(nodes)

    return (
        <GlassContext.Provider value={contextValue}>
            <div style={{ position: "relative" }} className={className}>
                <svg
                    style={{
                        position: "absolute",
                        width: 0,
                        height: 0,
                        pointerEvents: "none",
                    }}
                >
                    <defs>
                        <filter
                            id={filterId}
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                            colorInterpolationFilters="sRGB"
                        >
                            {/* Neutral displacement background (R=128, G=128) */}
                            <feFlood
                                floodColor="rgb(128,128,0)"
                                result="bg_0"
                            />

                            {nodeList.map((node, i) => (
                                <React.Fragment key={node.id}>
                                    <feImage
                                        id={`glass-map-${node.id}`}
                                        href={node.mapUrl}
                                        result={`img_${i + 1}`}
                                        x={0} // Initial values, will be driven directly by DOM updates from GlassNode
                                        y={0}
                                        width={node.lensW}
                                        height={node.lensH}
                                    />
                                    <feComposite
                                        in={`img_${i + 1}`}
                                        in2={`bg_${i}`}
                                        operator="over"
                                        result={`bg_${i + 1}`}
                                    />
                                </React.Fragment>
                            ))}

                            {/* Displace the actual content once using the final composite map */}
                            <feDisplacementMap
                                in="SourceGraphic"
                                in2={`bg_${nodeList.length}`}
                                scale={scale}
                                xChannelSelector="R"
                                yChannelSelector="G"
                            />
                        </filter>
                    </defs>
                </svg>

                {/* The refracted content */}
                <div
                    style={{
                        filter: `url(#${filterId})`,
                        width: "100%",
                        height: "100%",
                    }}
                >
                    {children}
                </div>
            </div>
        </GlassContext.Provider>
    )
}
