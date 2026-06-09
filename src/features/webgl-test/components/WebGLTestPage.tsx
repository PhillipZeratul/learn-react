import { useRef, useEffect, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useDrag } from "@use-gesture/react"
import { signal } from "@preact/signals-react"
import { Button } from "@/components/ui/Button"
import { Text, useFBO, Float } from "@react-three/drei"
import * as THREE from "three"

// --- Shaders ---
import fullscreenVert from "../shaders/fullscreen.vert.glsl?raw"
import backgroundFrag from "../shaders/background.frag.glsl?raw"
import liquidFrag from "../shaders/liquid.frag.glsl?raw"

// --- Micro-State via Signals ---
const button1Pos = signal({ x: -1000, y: -1000, radius: 40 })
const button2Pos = signal({ x: -1000, y: -1000, radius: 40 })
const windowSize = signal({ w: window.innerWidth, h: window.innerHeight })

// --- WebGL Background Shader ---
const BackgroundGradientMaterial = {
    uniforms: {
        u_time: { value: 0 },
    },
    vertexShader: fullscreenVert,
    fragmentShader: backgroundFrag,
}

// --- Liquid SDF Shader ---
const SDFShaderMaterial = {
    uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2() },
        u_b1_pos: { value: new THREE.Vector2() },
        u_b1_radius: { value: 0 },
        u_b2_pos: { value: new THREE.Vector2() },
        u_b2_radius: { value: 0 },
        u_sceneTexture: { value: null },
    },
    vertexShader: fullscreenVert,
    fragmentShader: liquidFrag,
}

function WebGLTextRenderer() {
    const { viewport } = useThree()
    const text1Ref = useRef<THREE.Group>(null)
    const text2Ref = useRef<THREE.Group>(null)

    useFrame(() => {
        if (text1Ref.current) {
            const x =
                (button1Pos.value.x / windowSize.value.w - 0.5) * viewport.width
            const y =
                (button1Pos.value.y / windowSize.value.h - 0.5) *
                viewport.height
            text1Ref.current.position.set(x, y, 0)
        }
        if (text2Ref.current) {
            const x =
                (button2Pos.value.x / windowSize.value.w - 0.5) * viewport.width
            const y =
                (button2Pos.value.y / windowSize.value.h - 0.5) *
                viewport.height
            text2Ref.current.position.set(x, y, 0)
        }
    })

    return (
        <group>
            <group ref={text1Ref}>
                <Text
                    fontSize={0.2}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    Exit
                </Text>
            </group>
            <group ref={text2Ref}>
                <Text
                    fontSize={0.2}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    Drag
                </Text>
            </group>
        </group>
    )
}

function LiquidPostProcess() {
    const { gl, scene, camera, viewport } = useThree()
    const renderTarget = useFBO({ samples: 4 }) // Anti-aliased FBO
    const materialRef = useRef<THREE.ShaderMaterial>(null)
    const quadRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        if (!materialRef.current || !quadRef.current) return

        // 1. Hide the quad so it doesn't render into the FBO
        quadRef.current.visible = false

        // 2. Capture the entire scene (3D objects + Text) into the FBO
        gl.setRenderTarget(renderTarget)
        gl.render(scene, camera)

        // 3. Unhide quad and pass the captured texture to the shader
        quadRef.current.visible = true
        gl.setRenderTarget(null)
        materialRef.current.uniforms.u_sceneTexture.value = renderTarget.texture

        // 4. Update Uniforms
        const mat = materialRef.current
        mat.uniforms.u_time.value = state.clock.elapsedTime
        mat.uniforms.u_resolution.value.set(
            windowSize.value.w,
            windowSize.value.h
        )
        mat.uniforms.u_b1_pos.value.set(button1Pos.value.x, button1Pos.value.y)
        mat.uniforms.u_b1_radius.value = button1Pos.value.radius
        mat.uniforms.u_b2_pos.value.set(button2Pos.value.x, button2Pos.value.y)
        mat.uniforms.u_b2_radius.value = button2Pos.value.radius

        // 5. Render the final composite to the screen
        gl.render(scene, camera)
    }, 1) // priority 1 ensures this runs AFTER standard renders

    return (
        <mesh ref={quadRef} position={[0, 0, 1]}>
            <planeGeometry args={[viewport.width, viewport.height]} />
            <shaderMaterial
                ref={materialRef}
                args={[SDFShaderMaterial]}
                transparent
            />
        </mesh>
    )
}

function ThreeDBackground() {
    const { viewport } = useThree()
    const bgMaterialRef = useRef<THREE.ShaderMaterial>(null)

    useFrame((state) => {
        if (bgMaterialRef.current) {
            bgMaterialRef.current.uniforms.u_time.value =
                state.clock.elapsedTime
        }
    })

    return (
        <>
            <mesh position={[0, 0, -10]}>
                <planeGeometry args={[viewport.width, viewport.height]} />
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
                        color="#f43f5e"
                        roughness={0.2}
                        metalness={0.5}
                    />
                </mesh>
            </Float>

            <Float speed={1.5} rotationIntensity={2} floatIntensity={1.5}>
                <mesh position={[2, -1, -4]}>
                    <boxGeometry args={[1.5, 1.5, 1.5]} />
                    <meshStandardMaterial
                        color="#10b981"
                        roughness={0.1}
                        metalness={0.8}
                    />
                </mesh>
            </Float>

            {/* Background pattern */}
            <gridHelper
                args={[20, 20, "#334155", "#1e293b"]}
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
            button1Pos.value = {
                x: rect.x + rect.width / 2,
                y: window.innerHeight - (rect.y + rect.height / 2),
                radius: rect.width / 2,
            }
        }
        if (dragBtnRef.current) {
            const rect = dragBtnRef.current.getBoundingClientRect()
            button2Pos.value = {
                x: rect.x + rect.width / 2,
                y: window.innerHeight - (rect.y + rect.height / 2),
                radius: rect.width / 2,
            }
        }
    }

    useEffect(() => {
        const handleResize = () => {
            windowSize.value = { w: window.innerWidth, h: window.innerHeight }
            updateSignals()
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    useEffect(() => {
        updateSignals()
    })

    const bindDrag = useDrag(({ offset: [ox, oy] }) => {
        setDragPos({ x: ox, y: oy })
        updateSignals()
    })

    return (
        <div className="relative h-svh w-full touch-none overflow-hidden bg-slate-900">
            {/* 3D WebGL Scene & Post-Processing (z: 0) */}
            <div className="pointer-events-none absolute inset-0 z-0">
                <Canvas
                    orthographic
                    camera={{ position: [0, 0, 5], zoom: 100 }}
                >
                    <ThreeDBackground />
                    <WebGLTextRenderer />
                    <LiquidPostProcess />
                </Canvas>
            </div>

            {/* DOM Hitbox Layer (z: 10) */}
            {/* All texts have been moved to WebGL. These buttons are entirely invisible hitboxes. */}
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-8">
                <h1 className="mb-12 text-transparent">True SDF Fusion</h1>

                <div className="pointer-events-auto relative flex h-64 w-full max-w-md items-center justify-center gap-16">
                    {/* Invisible Static Hitbox */}
                    <Button
                        ref={staticBtnRef}
                        variant="ghost"
                        onClick={onExit}
                        className="size-24 cursor-pointer rounded-full opacity-0"
                    >
                        Exit
                    </Button>

                    {/* Invisible Draggable Hitbox */}
                    <div
                        {...bindDrag()}
                        style={{
                            transform: `translate3d(${dragPos.x}px, ${dragPos.y}px, 0)`,
                        }}
                        className="cursor-grab active:cursor-grabbing"
                    >
                        <Button
                            ref={dragBtnRef}
                            variant="ghost"
                            className="pointer-events-none size-24 rounded-full opacity-0"
                        >
                            Drag
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
