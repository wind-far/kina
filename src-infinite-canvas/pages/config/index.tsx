import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { AppConfigPanel } from "@infinite/components/layout/app-config-modal";

export default function ConfigPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const embedded = searchParams.has("embedded");

    const finishEmbeddedConfig = () => {
        window.parent.postMessage({ type: "canvasmind:config-close" }, window.location.origin);
    };

    return (
        <main className="h-full overflow-y-auto bg-background">
            <div className={embedded ? "px-6 pb-6" : "mx-auto max-w-6xl px-6 py-6"}>
                {!embedded ? (
                    <div className="mb-5">
                        <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">{t("config.title")}</h1>
                        <p className="mt-1 text-sm text-stone-500">{t("config.description")}</p>
                    </div>
                ) : null}
                <AppConfigPanel showDoneButton={embedded} onDone={embedded ? finishEmbeddedConfig : undefined} />
            </div>
        </main>
    );
}
