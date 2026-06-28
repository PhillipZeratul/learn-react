/// <reference types="vite-plus" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import basicSsl from "@vitejs/plugin-basic-ssl"
import { defineConfig } from "vite-plus"
import { fileURLToPath } from "node:url"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "vite-plus/test/browser-playwright"

const dirname =
    typeof __dirname !== "undefined"
        ? __dirname
        : path.dirname(fileURLToPath(import.meta.url))

const isTauri =
    process.env.TAURI_ENV === "true" ||
    process.env.VITE_PLATFORM === "tauri" ||
    !!process.env.TAURI_ENV_PLATFORM
const isCapacitor =
    process.env.CAPACITOR_ENV === "true" ||
    process.env.VITE_PLATFORM === "capacitor"

export default defineConfig({
    lint: {
        plugins: ["oxc", "typescript", "unicorn", "react"],
        categories: {
            correctness: "warn",
        },
        env: {
            builtin: true,
        },
        ignorePatterns: ["dist", "android", "src-tauri", ".gemini", "public"],
        overrides: [
            {
                files: ["**/*.{ts,tsx}"],
                rules: {
                    "constructor-super": "error",
                    "for-direction": "error",
                    "getter-return": "error",
                    "no-async-promise-executor": "error",
                    "no-case-declarations": "error",
                    "no-class-assign": "error",
                    "no-compare-neg-zero": "error",
                    "no-cond-assign": "error",
                    "no-const-assign": "error",
                    "no-constant-binary-expression": "error",
                    "no-constant-condition": "error",
                    "no-control-regex": "error",
                    "no-debugger": "error",
                    "no-delete-var": "error",
                    "no-dupe-class-members": "error",
                    "no-dupe-else-if": "error",
                    "no-dupe-keys": "error",
                    "no-duplicate-case": "error",
                    "no-empty": "error",
                    "no-empty-character-class": "error",
                    "no-empty-pattern": "error",
                    "no-empty-static-block": "error",
                    "no-ex-assign": "error",
                    "no-extra-boolean-cast": "error",
                    "no-fallthrough": "error",
                    "no-func-assign": "error",
                    "no-global-assign": "error",
                    "no-import-assign": "error",
                    "no-invalid-regexp": "error",
                    "no-irregular-whitespace": "error",
                    "no-loss-of-precision": "error",
                    "no-misleading-character-class": "error",
                    "no-new-native-nonconstructor": "error",
                    "no-nonoctal-decimal-escape": "error",
                    "no-obj-calls": "error",
                    "no-prototype-builtins": "error",
                    "no-redeclare": "error",
                    "no-regex-spaces": "error",
                    "no-self-assign": "error",
                    "no-setter-return": "error",
                    "no-shadow-restricted-names": "error",
                    "no-sparse-arrays": "error",
                    "no-this-before-super": "error",
                    "no-undef": "error",
                    "no-unexpected-multiline": "error",
                    "no-unreachable": "error",
                    "no-unsafe-finally": "error",
                    "no-unsafe-negation": "error",
                    "no-unsafe-optional-chaining": "error",
                    "no-unused-labels": "error",
                    "no-unused-private-class-members": "error",
                    "no-unused-vars": "off",
                    "no-useless-backreference": "error",
                    "no-useless-catch": "error",
                    "no-useless-escape": "error",
                    "no-with": "error",
                    "require-yield": "error",
                    "use-isnan": "error",
                    "valid-typeof": "error",
                    "no-array-constructor": "error",
                    "no-unused-expressions": "error",
                    "typescript/ban-ts-comment": "error",
                    "typescript/no-duplicate-enum-values": "error",
                    "typescript/no-empty-object-type": "error",
                    "typescript/no-explicit-any": "error",
                    "typescript/no-floating-promises": "off",
                    "typescript/unbound-method": "off",
                    "typescript/no-extra-non-null-assertion": "error",
                    "typescript/no-misused-new": "error",
                    "typescript/no-namespace": "error",
                    "typescript/no-non-null-asserted-optional-chain": "error",
                    "typescript/no-require-imports": "error",
                    "typescript/no-this-alias": "error",
                    "typescript/no-unnecessary-type-constraint": "error",
                    "typescript/no-unsafe-declaration-merging": "error",
                    "typescript/no-unsafe-function-type": "error",
                    "typescript/no-redundant-type-constituents": "off",
                    "typescript/no-wrapper-object-types": "error",
                    "typescript/prefer-as-const": "error",
                    "typescript/prefer-namespace-keyword": "error",
                    "typescript/triple-slash-reference": "off",
                    "react/rules-of-hooks": "error",
                    "react/exhaustive-deps": "warn",
                    "react/only-export-components": [
                        "error",
                        {
                            allowConstantExport: true,
                        },
                    ],
                    "unused-imports/no-unused-imports": "error",
                    "unused-imports/no-unused-vars": [
                        "warn",
                        {
                            vars: "all",
                            varsIgnorePattern: "^_",
                            args: "after-used",
                            argsIgnorePattern: "^_",
                        },
                    ],
                },
                jsPlugins: ["eslint-plugin-unused-imports"],
                env: {
                    es2020: true,
                    browser: true,
                },
                globals: {
                    AudioWorkletGlobalScope: "readonly",
                    AudioWorkletProcessor: "readonly",
                    currentFrame: "readonly",
                    currentTime: "readonly",
                    registerProcessor: "readonly",
                    sampleRate: "readonly",
                    WorkletGlobalScope: "readonly",
                    process: "readonly",
                    __dirname: "readonly",
                },
            },
            {
                files: [
                    "**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)",
                    "**/*.story.@(ts|tsx|js|jsx|mjs|cjs)",
                ],
                rules: {
                    "storybook/await-interactions": "error",
                    "storybook/context-in-play-function": "error",
                    "storybook/default-exports": "error",
                    "storybook/hierarchy-separator": "warn",
                    "storybook/no-redundant-story-name": "warn",
                    "storybook/no-renderer-packages": "error",
                    "storybook/prefer-pascal-case": "warn",
                    "storybook/story-exports": "error",
                    "storybook/use-storybook-expect": "error",
                    "storybook/use-storybook-testing-library": "error",
                    "import/no-anonymous-default-export": "off",
                    "react/rules-of-hooks": "off",
                },
                jsPlugins: ["eslint-plugin-storybook"],
                plugins: ["import"],
            },
            {
                files: [".storybook/main.@(js|cjs|mjs|ts)"],
                rules: {
                    "storybook/no-uninstalled-addons": "error",
                },
                jsPlugins: ["eslint-plugin-storybook"],
            },
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
        jsPlugins: [
            {
                name: "vite-plus",
                specifier: "vite-plus/oxlint-plugin",
            },
        ],
        rules: {
            "vite-plus/prefer-vite-plus-imports": "error",
        },
    },
    staged: {
        "*.{ts,tsx}": ["vp lint --fix", "vp fmt"],
    },
    fmt: {
        endOfLine: "lf",
        semi: false,
        singleQuote: false,
        tabWidth: 4,
        useTabs: false,
        trailingComma: "es5",
        printWidth: 80,
        sortTailwindcss: {
            stylesheet: "src/index.css",
            functions: ["cn", "cva"],
        },
        sortPackageJson: false,
        ignorePatterns: [
            "node_modules/",
            "coverage/",
            ".pnpm-store/",
            "pnpm-lock.yaml",
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
        ],
    },
    plugins: [react(), tailwindcss(), basicSsl()],
    optimizeDeps: {
        exclude: ["@sqlite.org/sqlite-wasm", "react-grab"],
    },
    server: {
        headers: {
            // Required for WebSQLite OPFS high-performance sandboxing
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    define: {
        "import.meta.env.IS_TAURI": JSON.stringify(isTauri),
        "import.meta.env.IS_CAPACITOR": JSON.stringify(isCapacitor),
        "import.meta.env.IS_WEB": JSON.stringify(!isTauri && !isCapacitor),
    },
    resolve: {
        alias: {
            "@": path.resolve(dirname, "./src"),
        },
    },
    test: {
        // Base configurations shared across all projects
        globals: true,
        setupFiles: ["./src/shared/test/setup.ts"],
        passWithNoTests: true,
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/",
                "src/shared/ui/**",
                "**/*.config.ts",
                "**/*.d.ts",
                ".storybook/**",
            ],
        },
        projects: [
            // Project 1: Our High-Speed Unit Tests (FSD Models, Logic, Zustand)
            {
                extends: true,
                test: {
                    name: "unit",
                    environment: "happy-dom",
                    // Target standard test files, excluding Storybook stories
                    include: [
                        "src/**/*.test.{ts,tsx}",
                        "src/**/*.spec.{ts,tsx}",
                    ],
                    exclude: ["src/**/*.stories.{ts,tsx}"],
                },
            },
            // Project 2: Your Existing Storybook UI Tests
            {
                extends: true,
                plugins: [
                    storybookTest({
                        configDir: path.join(dirname, ".storybook"),
                    }),
                ],
                test: {
                    name: "storybook",
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({}),
                        instances: [
                            {
                                browser: "chromium",
                            },
                        ],
                    },
                },
            },
        ],
    },
})
