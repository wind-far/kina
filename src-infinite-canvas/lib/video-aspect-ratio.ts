export const VIDEO_ASPECT_RATIO_OPTIONS = [
    { value: "16:9", width: 16, height: 9 },
    { value: "9:16", width: 9, height: 16 },
    { value: "1:1", width: 1, height: 1 },
    { value: "21:9", width: 21, height: 9 },
    { value: "3:4", width: 3, height: 4 },
    { value: "4:3", width: 4, height: 3 },
] as const;

export function normalizeVideoAspectRatio(value: string | undefined) {
    const match = String(value || "").trim().match(/^(\d+)(?:x|:)(\d+)$/i);
    if (!match) return "16:9";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "16:9";
    return VIDEO_ASPECT_RATIO_OPTIONS.reduce((closest, item) => (
        Math.abs(item.width / item.height - width / height) < Math.abs(closest.width / closest.height - width / height) ? item : closest
    ), VIDEO_ASPECT_RATIO_OPTIONS[0]).value;
}

export function readVideoAspectRatioDimensions(value: string | undefined) {
    const ratio = normalizeVideoAspectRatio(value);
    const match = ratio.match(/^(\d+):(\d+)$/);
    return { width: Number(match?.[1]) || 16, height: Number(match?.[2]) || 9 };
}
