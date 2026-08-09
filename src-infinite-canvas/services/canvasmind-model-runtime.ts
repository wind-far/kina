import { decodeChannelModel, encodeChannelModel, resolveModelChannel, type AiConfig, type ModelCapability, type ModelChannel, useConfigStore } from "@infinite/stores/use-config-store";
import { normalizeVideoAspectRatio } from "@infinite/lib/video-aspect-ratio";

type CanvasMindModelCategory = "CHAT" | "IMAGE" | "VIDEO";

type CanvasMindCatalogModel = {
    selectionKey: string;
    providerId: string;
    providerName: string;
    category: CanvasMindModelCategory;
    label: string;
    modelKey: string;
    defaultParamsJson?: Record<string, unknown> | null;
};

type CanvasMindModelCatalog = {
    providers: Array<{ id: string; name: string }>;
    models: {
        chat: CanvasMindCatalogModel[];
        image: CanvasMindCatalogModel[];
        video: CanvasMindCatalogModel[];
    };
    defaults: { chat: string; image: string; video: string };
};

export type CanvasMindGenerationRecord = {
    id: string;
    content?: string;
    error?: string;
    done?: boolean;
    stopped?: boolean;
    images?: string[];
    outputs?: Array<{ outputType?: string; url?: string; textContent?: string }>;
};

type CanvasMindTaskPayload = {
    source: "infinite-canvas";
    type: "image" | "video" | "agent";
    requestMode?: "image-generation" | "image-edit" | "video-generation";
    prompt: string;
    model: string;
    modelKey: string;
    ratio?: string;
    resolution?: string;
    duration?: string;
    skill?: string;
    referenceImages?: string[];
    mediaReferences?: Array<{ mediaType: "image" | "video" | "audio"; url: string; role: string }>;
    requestBody: Record<string, unknown>;
};

export type CanvasMindTaskCreated = Pick<CanvasMindGenerationRecord, "id">;
type RequestOptions = {
    signal?: AbortSignal;
    onTaskCreated?: (task: CanvasMindTaskCreated) => void | Promise<void>;
};

const RUNTIME_BASE_URL = "canvasmind://local-environment";
const RUNTIME_SESSION_MARKER = "canvasmind-session";
const RUNTIME_CHANNEL_PREFIX = "canvasmind:";
let catalogPromise: Promise<CanvasMindModelCatalog> | null = null;

export function isCanvasMindRuntimeChannel(channel: ModelChannel | string) {
    const channelId = typeof channel === "string" ? channel : channel.id;
    return channelId.startsWith(RUNTIME_CHANNEL_PREFIX);
}

export function isCanvasMindModelRuntime() {
    if (typeof window === "undefined") return false;
    return window.parent !== window || window.location.hash.includes("source=canvasmind");
}

async function readApiData<T>(response: Response): Promise<T> {
    const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; error?: { message?: string } };
    if (!response.ok) {
        const fallback = response.status === 401 ? "登录状态已失效，请重新登录 CanvasMind" : `本地模型服务请求失败 (${response.status})`;
        throw new Error(String(payload.error?.message || payload.message || fallback));
    }
    return payload.data as T;
}

export function loadCanvasMindModelCatalog(force = false) {
    if (!force && catalogPromise) return catalogPromise;
    catalogPromise = fetch("/api/provider-config/catalog", {
        credentials: "include",
        cache: "no-store",
    })
        .then((response) => readApiData<CanvasMindModelCatalog>(response))
        .finally(() => {
            catalogPromise = null;
        });
    return catalogPromise;
}

const categoryModels = (catalog: CanvasMindModelCatalog, category: CanvasMindModelCategory) =>
    category === "CHAT" ? catalog.models.chat : category === "IMAGE" ? catalog.models.image : catalog.models.video;

function defaultCatalogModel(catalog: CanvasMindModelCatalog, category: CanvasMindModelCategory) {
    const models = categoryModels(catalog, category);
    const defaultKey = category === "CHAT" ? catalog.defaults.chat : category === "IMAGE" ? catalog.defaults.image : catalog.defaults.video;
    return models.find((item) => item.selectionKey === defaultKey || item.modelKey === defaultKey) || models[0] || null;
}

function encodedCatalogModel(model: CanvasMindCatalogModel | null) {
    return model ? encodeChannelModel(`${RUNTIME_CHANNEL_PREFIX}${model.providerId}`, model.modelKey) : "";
}

function buildRuntimeConfig(base: AiConfig, catalog: CanvasMindModelCatalog): AiConfig {
    const allModels = [...catalog.models.chat, ...catalog.models.image, ...catalog.models.video];
    const providers = new Map(catalog.providers.map((provider) => [provider.id, provider.name]));
    const capabilityByCategory: Record<CanvasMindModelCategory, ModelCapability> = { CHAT: "text", IMAGE: "image", VIDEO: "video" };
    const channels: ModelChannel[] = Array.from(new Set(allModels.map((model) => model.providerId))).map((providerId) => ({
        id: `${RUNTIME_CHANNEL_PREFIX}${providerId}`,
        name: providers.get(providerId) || allModels.find((model) => model.providerId === providerId)?.providerName || "本地模型",
        baseUrl: RUNTIME_BASE_URL,
        apiKey: RUNTIME_SESSION_MARKER,
        apiFormat: "openai",
        models: allModels
            .filter((model) => model.providerId === providerId)
            .map((model) => ({ name: model.modelKey, capability: capabilityByCategory[model.category] })),
    }));
    const imageDefault = defaultCatalogModel(catalog, "IMAGE");
    const videoDefault = defaultCatalogModel(catalog, "VIDEO");
    const textDefault = defaultCatalogModel(catalog, "CHAT");
    const imageModel = encodedCatalogModel(imageDefault);
    const videoModel = encodedCatalogModel(videoDefault);
    const textModel = encodedCatalogModel(textDefault);
    const models = channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model.name)));
    const defaultImageSize = String(imageDefault?.defaultParamsJson?.size || "").trim();

    return {
        ...base,
        channelMode: "local",
        baseUrl: RUNTIME_BASE_URL,
        apiKey: RUNTIME_SESSION_MARKER,
        channels,
        models,
        model: imageModel || textModel || videoModel,
        imageModel,
        videoModel,
        textModel,
        audioModel: "",
        ...(defaultImageSize ? { size: defaultImageSize } : {}),
    };
}

export async function initializeCanvasMindModelRuntime() {
    if (!isCanvasMindModelRuntime()) return null;
    const catalog = await loadCanvasMindModelCatalog();
    const modelCount = catalog.models.chat.length + catalog.models.image.length + catalog.models.video.length;
    if (!modelCount) throw new Error("本地环境尚未配置可用模型，请先在 CanvasMind 后台配置模型厂商");
    const store = useConfigStore.getState();
    const runtimeConfig = buildRuntimeConfig(store.config, catalog);
    store.setRuntimeConfig(runtimeConfig);
    return runtimeConfig;
}

export function shouldUseCanvasMindModelRuntime(config: AiConfig, capability: ModelCapability) {
    if (!isCanvasMindModelRuntime()) return false;
    const fallback = capability === "image" ? config.imageModel : capability === "video" ? config.videoModel : capability === "audio" ? config.audioModel : config.textModel;
    const selected = config.model || fallback;
    if (!selected) return false;
    const channel = resolveModelChannel(config, selected);
    return channel.id.startsWith(RUNTIME_CHANNEL_PREFIX) && channel.baseUrl === RUNTIME_BASE_URL && channel.apiKey === RUNTIME_SESSION_MARKER;
}

function selectedModelValue(config: AiConfig, category: CanvasMindModelCategory) {
    if (category === "IMAGE") return config.model || config.imageModel;
    if (category === "VIDEO") return config.model || config.videoModel;
    return config.model || config.textModel;
}

async function resolveRuntimeModel(config: AiConfig, category: CanvasMindModelCategory) {
    const catalog = await loadCanvasMindModelCatalog();
    const requested = selectedModelValue(config, category);
    const decoded = decodeChannelModel(requested);
    const requestedProviderId = decoded?.channelId.startsWith(RUNTIME_CHANNEL_PREFIX)
        ? decoded.channelId.slice(RUNTIME_CHANNEL_PREFIX.length)
        : decoded?.channelId;
    const models = categoryModels(catalog, category);
    const matched = decoded
        ? models.find((model) => model.providerId === requestedProviderId && model.modelKey === decoded.model)
        : models.find((model) => model.selectionKey === requested || model.modelKey === requested || model.label === requested);
    const model = matched || defaultCatalogModel(catalog, category);
    if (!model) {
        const label = category === "IMAGE" ? "图片" : category === "VIDEO" ? "视频" : "对话";
        throw new Error(`本地环境尚未配置可用${label}模型`);
    }
    return model;
}

async function createTask(payload: CanvasMindTaskPayload, options?: RequestOptions) {
    const response = await fetch("/api/generation-tasks", {
        method: "POST",
        credentials: "include",
        signal: options?.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return readApiData<CanvasMindGenerationRecord>(response);
}

async function notifyTaskCreated(task: CanvasMindTaskCreated, options?: RequestOptions) {
    try {
        await options?.onTaskCreated?.(task);
    } catch (error) {
        console.error("[infinite-canvas] generation task persistence failed", error);
    }
}

const wait = (milliseconds: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = window.setTimeout(resolve, milliseconds);
        signal?.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
    });

async function getTask(taskId: string, options?: RequestOptions) {
    const response = await fetch(`/api/generation-tasks/${encodeURIComponent(taskId)}`, {
        credentials: "include",
        cache: "no-store",
        signal: options?.signal,
    });
    return readApiData<CanvasMindGenerationRecord>(response);
}

async function waitForTask(initial: CanvasMindGenerationRecord, options?: RequestOptions, onProgress?: (record: CanvasMindGenerationRecord) => void) {
    let record = initial;
    for (;;) {
        onProgress?.(record);
        if (record.done) {
            if (record.stopped) throw new DOMException("生成任务已停止", "AbortError");
            if (record.error) throw new Error(record.error);
            return record;
        }
        await wait(800, options?.signal);
        record = await getTask(record.id, options);
    }
}

export async function resumeCanvasMindGenerationTask(taskId: string, options?: Pick<RequestOptions, "signal">) {
    return waitForTask(await getTask(taskId, options), options);
}

export async function requestCanvasMindImages(config: AiConfig, prompt: string, referenceImages: string[] = [], options?: RequestOptions) {
    const model = await resolveRuntimeModel(config, "IMAGE");
    const count = Math.max(1, Math.floor(Number(config.count) || 1));
    const requestBody: Record<string, unknown> = {
        providerId: model.providerId,
        model: model.modelKey,
        prompt,
        n: count,
        count,
    };
    if (config.size && config.size !== "auto") requestBody.size = config.size;
    if (config.quality && config.quality !== "auto") requestBody.quality = config.quality;
    const task = await createTask({
        source: "infinite-canvas",
        type: "image",
        requestMode: referenceImages.length ? "image-edit" : "image-generation",
        prompt,
        model: model.label,
        modelKey: model.modelKey,
        referenceImages,
        requestBody,
    }, options);
    await notifyTaskCreated(task, options);
    const completed = await waitForTask(task, options);
    const images = (completed.images || []).filter(Boolean);
    if (!images.length) throw new Error("本地图片模型任务已完成，但没有返回图片");
    return images;
}

export async function requestCanvasMindVideo(
    config: AiConfig,
    prompt: string,
    referenceImages: string[],
    mediaReferences: Array<{ mediaType: "video" | "audio"; url: string; role: string }>,
    options?: RequestOptions,
) {
    const model = await resolveRuntimeModel(config, "VIDEO");
    const ratio = normalizeVideoAspectRatio(config.size);
    const allMediaReferences = [
        ...referenceImages.map((url) => ({ mediaType: "image" as const, url, role: "reference" })),
        ...mediaReferences,
    ];
    const task = await createTask({
        source: "infinite-canvas",
        type: "video",
        requestMode: "video-generation",
        prompt,
        model: model.label,
        modelKey: model.modelKey,
        ratio,
        resolution: config.vquality,
        duration: config.videoSeconds,
        referenceImages,
        mediaReferences: allMediaReferences,
        requestBody: {
            providerId: model.providerId,
            model: model.modelKey,
            prompt,
            ratio,
            quality: config.vquality,
            duration: config.videoSeconds,
        },
    }, options);
    await notifyTaskCreated(task, options);
    const completed = await waitForTask(task, options);
    const output = (completed.outputs || []).find((item) => item.outputType === "video" && item.url);
    if (!output?.url) throw new Error("本地视频模型任务已完成，但没有返回视频");
    return output.url;
}

export async function requestCanvasMindText(
    config: AiConfig,
    messages: unknown[],
    onDelta: (text: string) => void,
    options?: RequestOptions,
) {
    const model = await resolveRuntimeModel(config, "CHAT");
    const lastMessage = messages[messages.length - 1] as { content?: unknown } | undefined;
    const prompt = typeof lastMessage?.content === "string" ? lastMessage.content : "请根据上下文生成内容";
    let streamed = "";
    const task = await createTask({
        source: "infinite-canvas",
        type: "agent",
        prompt,
        model: model.label,
        modelKey: model.modelKey,
        skill: "general",
        requestBody: {
            providerId: model.providerId,
            model: model.modelKey,
            messages,
            stream: true,
        },
    }, options);
    await notifyTaskCreated(task, options);
    const completed = await waitForTask(task, options, (record) => {
        const content = String(record.content || "");
        if (!content || content === streamed) return;
        const delta = content.startsWith(streamed) ? content.slice(streamed.length) : content;
        streamed = content;
        if (delta) onDelta(delta);
    });
    const content = String(completed.content || streamed || "");
    if (!content) throw new Error("本地对话模型任务已完成，但没有返回文本");
    return content;
}

export async function runtimeMediaUrl(url: string) {
    if (!url.startsWith("blob:")) return url;
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("读取本地媒体失败"));
        reader.readAsDataURL(blob);
    });
}
