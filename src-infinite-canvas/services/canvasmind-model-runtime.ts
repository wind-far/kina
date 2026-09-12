import { decodeChannelModel, encodeChannelModel, resolveModelChannel, type AiConfig, type ModelCapability, type ModelChannel, useConfigStore } from "@infinite/stores/use-config-store";
import { normalizeVideoAspectRatio } from "@infinite/lib/video-aspect-ratio";
import { getImageBlob } from "@infinite/services/image-storage";
import type { ReferenceImage } from "@infinite/types/image";

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

type CanvasMindStorageUpload = {
    publicUrl?: string;
    providerPublicUrl?: string | null;
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
const runtimeReferenceImageUploads = new Map<string, Promise<CanvasMindStorageUpload>>();

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

async function readRuntimeReferenceImageBlob(image: ReferenceImage) {
    const source = String(image.dataUrl || image.url || "").trim();
    if (!source) throw new Error("视频参考图内容为空");
    const response = await fetch(source);
    if (!response.ok) throw new Error(`视频参考图读取失败 (${response.status})`);
    return response.blob();
}

async function uploadRuntimeReferenceImage(image: ReferenceImage, blob: Blob, signal?: AbortSignal) {
    const mimeType = blob.type || image.type || "image/png";
    if (!mimeType.startsWith("image/")) throw new Error("视频参考素材必须是图片");
    const response = await fetch("/api/storage/upload", {
        method: "POST",
        credentials: "include",
        signal,
        headers: {
            "Content-Type": mimeType,
            "x-upload-filename": encodeURIComponent(image.name || "video-reference.png"),
            "x-upload-category": "reference",
        },
        body: blob,
    });
    const uploaded = await readApiData<CanvasMindStorageUpload>(response);
    return uploaded;
}

const uploadedReferenceImageUrl = (uploaded: CanvasMindStorageUpload, purpose: "task" | "provider") => {
    const value = String(purpose === "provider"
        ? uploaded.providerPublicUrl || ""
        : uploaded.publicUrl || uploaded.providerPublicUrl || "").trim();
    if (purpose === "task" && (value.startsWith("/uploads/") || /^https?:\/\//i.test(value))) return value;
    if (purpose === "provider" && /^https:\/\//i.test(value)) return value;
    throw new Error(purpose === "provider"
        ? "视频参考图上传后没有公网 URL；请配置对象存储或 VIDEO_REFERENCE_PUBLIC_BASE_URL"
        : "视频参考图上传后未返回稳定 URL");
};

const isProviderPublicHttpsUrl = (value: string) => {
    try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        if (url.protocol !== "https:" || url.username || url.password
            || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
        const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
        if (ipv4) {
            const [first, second] = ipv4.slice(1).map(Number);
            if (first === 0 || first === 10 || first === 127 || first >= 224
                || (first === 100 && second >= 64 && second <= 127)
                || (first === 169 && second === 254)
                || (first === 172 && second >= 16 && second <= 31)
                || (first === 192 && second === 168)
                || (first === 198 && (second === 18 || second === 19))
                || (first === 192 && second === 0)
                || (first === 198 && second === 51)
                || (first === 203 && second === 0)) return false;
        }
        if (hostname.includes(":")) {
            return hostname !== "::" && hostname !== "::1"
                && !hostname.startsWith("fc") && !hostname.startsWith("fd")
                && !hostname.startsWith("fe80:") && !hostname.startsWith("::ffff:");
        }
        return true;
    } catch {
        return false;
    }
};

async function resolveRuntimeReferenceImageUrl(image: ReferenceImage, signal: AbortSignal | undefined, purpose: "task" | "provider") {
    if (image.storageKey) {
        const existingUpload = runtimeReferenceImageUploads.get(image.storageKey);
        if (existingUpload) return uploadedReferenceImageUrl(await existingUpload, purpose);
        const storedBlob = await getImageBlob(image.storageKey);
        if (storedBlob) {
            const upload = uploadRuntimeReferenceImage(image, storedBlob, signal);
            runtimeReferenceImageUploads.set(image.storageKey, upload);
            try {
                return uploadedReferenceImageUrl(await upload, purpose);
            } catch (error) {
                runtimeReferenceImageUploads.delete(image.storageKey);
                throw error;
            }
        }
    }
    const candidates = [image.url, image.dataUrl]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
    const remoteUrl = candidates.find((value) => purpose === "provider"
        ? isProviderPublicHttpsUrl(value)
        : /^https?:\/\//i.test(value));
    if (remoteUrl) return remoteUrl;
    const managedUrl = candidates.find((value) => value.startsWith("/uploads/"));
    if (managedUrl && purpose === "task") return managedUrl;
    const blob = await readRuntimeReferenceImageBlob(image);
    return uploadedReferenceImageUrl(await uploadRuntimeReferenceImage(image, blob, signal), purpose);
}

/** CanvasMind 后台任务只需稳定 URL；站内路径由服务端在请求上游前转换。 */
export async function runtimeTaskReferenceImageUrl(image: ReferenceImage, signal?: AbortSignal) {
    return resolveRuntimeReferenceImageUrl(image, signal, "task");
}

/** 浏览器直连视频供应商时，参考图必须先物化为公网 HTTPS URL。 */
export async function runtimeReferenceImageUrl(image: ReferenceImage, signal?: AbortSignal) {
    return resolveRuntimeReferenceImageUrl(image, signal, "provider");
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
