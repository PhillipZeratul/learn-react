import { createContext, useContext } from "react"

export type GlassNodeData = {
    id: string
    mapUrl: string
    lensW: number
    lensH: number
}

export type GlassContextType = {
    registerNode: (node: GlassNodeData) => void
    unregisterNode: (id: string) => void
}

export const GlassContext = createContext<GlassContextType | null>(null)

export function useGlass() {
    return useContext(GlassContext)
}
