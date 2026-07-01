import { useRef, useEffect, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useDrag } from "@use-gesture/react"
import { signal } from "@preact/signals-react"
import { Button } from "@/components/ui/Button"
import { GlassProvider } from "@/components/ui/GlassProvider"
import { GlassNode } from "@/components/ui/GlassNode"
import { Squircle } from "@/components/ui/Squircle"
import { Float } from "@react-three/drei"
import * as THREE from "three"

// --- Shaders ---
import fullscreenVert from "../shaders/fullscreen.vert.glsl?raw"
import backgroundFrag from "../shaders/background.frag.glsl?raw"

// --- Micro-State via Signals ---
const exitBtnPos = signal({ x: -1000, y: -1000 })
const dragBtnPos = signal({ x: -1000, y: -1000 })
const windowSize = signal({ w: window.innerWidth, h: window.innerHeight })

// --- WebGL Background Shader ---
const BackgroundGradientMaterial = {
    uniforms: {
        u_time: { value: 0 },
    },
    vertexShader: fullscreenVert,
    fragmentShader: backgroundFrag,
}

function ThreeDBackground() {
    const bgMaterialRef = useRef<THREE.ShaderMaterial>(null)
    const timeRef = useRef(0)

    useFrame((_state, delta) => {
        if (bgMaterialRef.current) {
            timeRef.current += delta
            bgMaterialRef.current.uniforms.u_time.value = timeRef.current
        }
    })

    return (
        <>
            <mesh position={[0, 0, -10]}>
                <planeGeometry args={[100, 100]} />
                <shaderMaterial
                    ref={bgMaterialRef}
                    args={[BackgroundGradientMaterial]}
                    depthWrite={false}
                />
            </mesh>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />

            <Float speed={2} rotationIntensity={1} floatIntensity={2}>
                <mesh position={[-2, 1, -3]}>
                    <sphereGeometry args={[0.8, 32, 32]} />
                    <meshStandardMaterial
                        color="#9FA1FF"
                        roughness={0.2}
                        metalness={0.0}
                    />
                </mesh>
            </Float>

            <Float speed={1.5} rotationIntensity={2} floatIntensity={1.5}>
                <mesh position={[2, -1, -4]}>
                    <boxGeometry args={[1.5, 1.5, 1.5]} />
                    <meshStandardMaterial
                        color="#B5BAFF"
                        roughness={0.1}
                        metalness={0.0}
                    />
                </mesh>
            </Float>

            {/* Background pattern */}
            <gridHelper
                args={[20, 20, "#D9F9DF", "#D9F9DF"]}
                position={[0, -2, -5]}
                rotation={[Math.PI / 4, 0, 0]}
            />
        </>
    )
}

export function WebGLTestPage({ onExit }: { onExit: () => void }) {
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 })

    const staticBtnRef = useRef<HTMLButtonElement>(null)
    const dragBtnRef = useRef<HTMLButtonElement>(null)

    const updateSignals = () => {
        if (staticBtnRef.current) {
            const rect = staticBtnRef.current.getBoundingClientRect()
            if (
                exitBtnPos.value.x !== rect.x ||
                exitBtnPos.value.y !== rect.y
            ) {
                exitBtnPos.value = { x: rect.x, y: rect.y }
            }
        }
        if (dragBtnRef.current) {
            const rect = dragBtnRef.current.getBoundingClientRect()
            if (
                dragBtnPos.value.x !== rect.x ||
                dragBtnPos.value.y !== rect.y
            ) {
                dragBtnPos.value = { x: rect.x, y: rect.y }
            }
        }
    }

    useEffect(() => {
        const handleResize = () => {
            windowSize.value = { w: window.innerWidth, h: window.innerHeight }
            updateSignals()
        }
        window.addEventListener("resize", handleResize)

        // Use a short delay for initial setup to ensure layout is complete
        const timeoutId = setTimeout(updateSignals, 100)

        return () => {
            window.removeEventListener("resize", handleResize)
            clearTimeout(timeoutId)
        }
    }, [])

    const bindDrag = useDrag(({ offset: [ox, oy] }) => {
        setDragPos({ x: ox, y: oy })
        updateSignals()
    })

    return (
        <div className="relative h-svh w-full touch-none overflow-hidden bg-slate-900">
            <GlassProvider scale={40} className="h-full w-full">
                {/* 3D WebGL Background Scene */}
                <div className="pointer-events-none absolute inset-0 z-0">
                    <Canvas
                        orthographic
                        camera={{ position: [0, 0, 5], zoom: 100 }}
                    >
                        <ThreeDBackground />
                    </Canvas>
                </div>

                {/* DOM Hitbox Layer */}
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8">
                    <h1 className="mb-12 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-5xl font-black text-transparent shadow-xl">
                        Liquid Glass Effect
                    </h1>

                    <div className="pointer-events-auto relative flex h-64 w-full max-w-md items-center justify-center gap-16">
                        {/* Static Exit Button */}
                        <Squircle n={4} className="size-24">
                            <Button
                                ref={staticBtnRef}
                                variant="outline"
                                onClick={onExit}
                                className="size-full cursor-pointer rounded-none border-0 bg-white/5 font-bold text-white shadow-lg transition-transform hover:scale-110"
                            >
                                Exit
                            </Button>
                        </Squircle>

                        {/* Draggable Glass Handle */}
                        <Squircle
                            n={4}
                            {...bindDrag()}
                            style={{
                                transform: `translate3d(${dragPos.x}px, ${dragPos.y}px, 0)`,
                            }}
                            className="size-24 cursor-grab touch-none active:cursor-grabbing"
                        >
                            <Button
                                ref={dragBtnRef}
                                variant="outline"
                                className="size-full rounded-none border-0 bg-white/5 text-white shadow-sm"
                            >
                                Drag Me
                            </Button>
                        </Squircle>
                    </div>
                </div>

                {/* The Glass Lenses (Refract whatever is behind them) */}
                <GlassNode
                    lensW={96}
                    lensH={96}
                    n={4}
                    distortionIntensity={0.5}
                    x={exitBtnPos.value.x}
                    y={exitBtnPos.value.y}
                />

                <GlassNode
                    lensW={96}
                    lensH={96}
                    n={4}
                    distortionIntensity={0.5}
                    x={dragBtnPos.value.x}
                    y={dragBtnPos.value.y}
                />
            </GlassProvider>
        </div>
    )
}
