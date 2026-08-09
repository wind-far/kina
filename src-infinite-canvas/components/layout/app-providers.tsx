import type { ReactNode } from "react";
import { useEffect } from "react";
import { ProConfigProvider } from "@ant-design/pro-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import enUS from "antd/es/locale/en_US";
import zhCN from "antd/es/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { useTranslation } from "react-i18next";

import { ClientRootInit } from "@infinite/components/layout/client-root-init";
import type { AppLocale } from "@infinite/i18n";
import { getAntThemeConfig } from "@infinite/lib/app-theme";
import { useThemeStore } from "@infinite/stores/use-theme-store";

const canvasMindThemeTokenNames = new Set([
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--input",
    "--border",
    "--ring",
    "--bg-body",
    "--bg-surface",
    "--brand-main-default",
    "--brand-main-hover",
    "--canvas-bg",
    "--canvas-node-bg",
    "--canvas-node-border",
    "--canvas-node-elevated",
    "--canvas-float-block-default",
    "--canvas-float-block-hover",
    "--canvas-float-block-pressed",
    "--canvas-selection-border",
    "--text-primary",
    "--text-secondary",
    "--text-tertiary",
    "--text-placeholder",
    "--text-disabled",
    "--stroke-primary",
    "--stroke-secondary",
    "--stroke-tertiary",
    "--functional-error",
]);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});

export function AppProviders({ children }: { children: ReactNode }) {
    const { i18n, t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const dark = theme === "dark";
    const locale = i18n.resolvedLanguage as AppLocale;

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = theme;
    }, [dark, theme]);

    useEffect(() => {
        const handleCanvasMindTheme = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.data?.type !== "canvasmind:theme") return;
            if (event.data.theme === "light" || event.data.theme === "dark") setTheme(event.data.theme);
            if (!event.data.tokens || typeof event.data.tokens !== "object") return;
            for (const [name, rawValue] of Object.entries(event.data.tokens)) {
                if (!canvasMindThemeTokenNames.has(name) || typeof rawValue !== "string") continue;
                const value = rawValue.trim();
                if (value) document.documentElement.style.setProperty(name, value);
            }
        };
        window.addEventListener("message", handleCanvasMindTheme);
        return () => window.removeEventListener("message", handleCanvasMindTheme);
    }, [setTheme]);

    useEffect(() => {
        document.documentElement.lang = locale;
        document.title = t("meta.title");
        document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));
        dayjs.locale(locale === "zh-CN" ? "zh-cn" : "en");
    }, [locale, t]);

    return (
        <ConfigProvider locale={locale === "zh-CN" ? zhCN : enUS} theme={getAntThemeConfig(dark)}>
            <ProConfigProvider dark={dark}>
                <App>
                    <QueryClientProvider client={queryClient}>
                        <ClientRootInit>{children}</ClientRootInit>
                    </QueryClientProvider>
                </App>
            </ProConfigProvider>
        </ConfigProvider>
    );
}
