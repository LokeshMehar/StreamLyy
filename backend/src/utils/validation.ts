const ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
];

export function validateFileType(fileType: string): boolean
{
    return ALLOWED_FILE_TYPES.includes(fileType.toLowerCase());
}

export function sanitizeS3Key(key: string): string | null
{
    if (!key || typeof key !== "string") return null;
    const sanitized = key.replace(/[^a-zA-Z0-9-_./]/g, "").replace(/\/+/g, "/");
    return sanitized.startsWith("/") ? sanitized.slice(1) : sanitized;
}