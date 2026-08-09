import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { AgentPanel } from "@infinite/components/agent/agent-panel";
import { AppTopNav } from "@infinite/components/layout/app-top-nav";

export default function UserLayout({ children }: { children: ReactNode }) {
    const { search } = useLocation();
    const embedded = new URLSearchParams(search).has("embedded");

    if (embedded) {
        return <div className="h-dvh overflow-hidden bg-background text-foreground">{children}</div>;
    }

    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <AppTopNav />
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            <AgentPanel />
        </div>
    );
}
