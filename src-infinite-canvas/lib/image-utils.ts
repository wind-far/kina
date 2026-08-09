import i18n from "@infinite/i18n";
import type { ReferenceImage } from "@infinite/types/image";

export function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "";
    }
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number) {
    const value = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return minutes ? i18n.t("common.durationMinutes", { minutes, seconds: String(seconds).padStart(2, "0") }) : i18n.t("common.durationSeconds", { seconds });
}

export function getDataUrlByteSize(dataUrl: string) {
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) {
        return 0;
    }
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(i18n.t("common.imageReadFailed")));
        reader.readAsDataURL(file);
    });
}

export function readImageMeta(dataUrl: string) {
    return new Promise<{ width: number; height: number; mimeType: string }>((resolve) => {
        const image = new Image();
        const done = () => resolve({ width: image.naturalWidth || 1024, height: image.naturalHeight || 1024, mimeType: dataUrl.match(/^data:([^;]+)/)?.[1] || "image/png" });
        image.onload = done;
        image.onerror = done;
        setTimeout(done, 3000);
        image.src = dataUrl;
    });
}

export function dataUrlToFile(image: ReferenceImage) {
    const [header, content] = image.dataUrl.split(",", 2);
    const mimeType = header.match(/data:(.*?);base64/)?.[1] || image.type || "image/png";
    const binary = atob(content || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], image.name || "reference.png", { type: mimeType });
}

export async function referenceImagesToSingleFile(images: ReferenceImage[]) {
    if (!images.length) return null;
    if (images.length === 1) return dataUrlToFile(images[0]);

    const sources = await Promise.all(images.map((image) => loadImage(image.dataUrl)));
    const columns = Math.ceil(Math.sqrt(sources.length));
    const rows = Math.ceil(sources.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 2048;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(i18n.t("common.imageReadFailed"));

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cellWidth = canvas.width / columns;
    const cellHeight = canvas.height / rows;
    const padding = 24;
    const labelHeight = 62;

    sources.forEach((source, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = column * cellWidth;
        const y = row * cellHeight;
        const availableWidth = cellWidth - padding * 2;
        const availableHeight = cellHeight - padding * 2 - labelHeight;
        const scale = Math.min(availableWidth / source.naturalWidth, availableHeight / source.naturalHeight);
        const width = source.naturalWidth * scale;
        const height = source.naturalHeight * scale;
        const imageX = x + (cellWidth - width) / 2;
        const imageY = y + padding + labelHeight + (availableHeight - height) / 2;

        context.fillStyle = "#111827";
        context.font = "600 36px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`参考图 ${index + 1}`, x + cellWidth / 2, y + padding + labelHeight / 2);
        context.drawImage(source, imageX, imageY, width, height);
        context.strokeStyle = "#d1d5db";
        context.lineWidth = 3;
        context.strokeRect(x + padding / 2, y + padding / 2, cellWidth - padding, cellHeight - padding);
    });

    const blob = await canvasToBlob(canvas);
    return new File([blob], "reference-board.png", { type: "image/png" });
}

function loadImage(dataUrl: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(i18n.t("common.imageReadFailed")));
        image.src = dataUrl;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(i18n.t("common.imageReadFailed")))), "image/png");
    });
}
