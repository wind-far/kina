export type CanvasColorTheme = "light" | "dark";
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const canvasThemes = {
    light: {
        canvas: {
            background: "var(--canvas-bg, #f1f2f3)",
            dot: "color-mix(in srgb, var(--text-primary, #0f1419) 28%, transparent)",
            line: "color-mix(in srgb, var(--text-primary, #0f1419) 12%, transparent)",
            selectionStroke: "var(--canvas-selection-border, #00a1c2)",
            selectionFill: "color-mix(in srgb, var(--canvas-selection-border, #00a1c2) 10%, transparent)",
        },
        node: {
            label: "var(--text-secondary, #536471)",
            fill: "var(--canvas-node-bg, #ffffff)",
            panel: "var(--canvas-node-elevated, #f7f7f7)",
            stroke: "var(--canvas-node-border, rgba(0, 0, 0, 0.08))",
            activeStroke: "var(--canvas-selection-border, #00a1c2)",
            placeholder: "var(--text-placeholder, #536471a3)",
            text: "var(--text-primary, #0f1419)",
            muted: "var(--text-secondary, #536471)",
            faint: "var(--text-tertiary, #72808a)",
        },
        toolbar: {
            panel: "var(--canvas-float-block-default, rgba(255, 255, 255, 0.92))",
            border: "var(--stroke-secondary, rgba(0, 0, 0, 0.05))",
            item: "var(--text-secondary, #536471)",
            itemHover: "var(--canvas-float-block-hover, rgba(245, 245, 245, 0.92))",
            activeBg: "var(--canvas-float-block-pressed, rgba(235, 235, 235, 0.92))",
            activeText: "var(--text-primary, #0f1419)",
        },
    },
    dark: {
        canvas: {
            background: "var(--canvas-bg, #0f0f12)",
            dot: "color-mix(in srgb, var(--text-primary, #f5fbff) 24%, transparent)",
            line: "color-mix(in srgb, var(--text-primary, #f5fbff) 10%, transparent)",
            selectionStroke: "var(--canvas-selection-border, #00cae0)",
            selectionFill: "color-mix(in srgb, var(--canvas-selection-border, #00cae0) 12%, transparent)",
        },
        node: {
            label: "var(--text-secondary, #e0f5ff99)",
            fill: "var(--canvas-node-bg, #1a1a1c)",
            panel: "var(--canvas-node-elevated, #1f1f1f)",
            stroke: "var(--canvas-node-border, #3a3a3a)",
            activeStroke: "var(--canvas-selection-border, #00cae0)",
            placeholder: "var(--text-placeholder, #e0f5ff59)",
            text: "var(--text-primary, #f5fbff)",
            muted: "var(--text-secondary, #e0f5ff99)",
            faint: "var(--text-tertiary, #e0f5ff7a)",
        },
        toolbar: {
            panel: "var(--canvas-float-block-default, rgba(32, 33, 39, 0.72))",
            border: "var(--stroke-secondary, rgba(204, 221, 255, 0.06))",
            item: "var(--text-secondary, #e0f5ff99)",
            itemHover: "var(--canvas-float-block-hover, rgba(38, 39, 45, 0.72))",
            activeBg: "var(--canvas-float-block-pressed, rgba(28, 29, 35, 0.72))",
            activeText: "var(--text-primary, #f5fbff)",
        },
    },
} as const;

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme];
