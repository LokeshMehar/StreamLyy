import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
import { validateFileType, sanitizeS3Key } from "../utils/validation";

dotenv.config({ path: "./.env" });

// Validate environment variables
const requiredEnvVars = ["AWS_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET", "AWS_REGION"];
for (const envVar of requiredEnvVars)
{
    if (!process.env[envVar])
    {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

const s3 = new S3Client({
    region: process.env.AWS_REGION as string,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
});

export async function generateUploadUrl(dirname: string, filename: string, contentType: string)
{
    if (!dirname || !filename || !contentType)
    {
        throw new Error("Missing required parameters for upload URL");
    }
    if (!validateFileType(contentType))
    {
        throw new Error("Invalid content type");
    }

    const sanitizedKey = sanitizeS3Key(`${dirname}${filename}`);
    if (!sanitizedKey)
    {
        throw new Error("Invalid S3 key");
    }

    const params = {
        Bucket: process.env.S3_BUCKET,
        Key: sanitizedKey,
        ContentType: contentType,
    };

    const expiresIn = 300; // 5 minutes
    try
    {
        const url = await getSignedUrl(s3, new PutObjectCommand(params), { expiresIn });
        return url;
    } catch (error)
    {
        throw Object.assign(new Error("Failed to generate S3 upload URL"), {
            status: 500,
            code: "S3_UPLOAD_URL_FAILED",
            cause: error,
        });
    }
}

export async function generateAccessUrl(key: string)
{
    const sanitizedKey = sanitizeS3Key(key);
    if (!sanitizedKey)
    {
        throw new Error("Invalid S3 key");
    }

    const params = {
        Bucket: process.env.S3_BUCKET,
        Key: sanitizedKey,
    };

    const expiresIn = 3600; // 1 hour
    try
    {
        const url = await getSignedUrl(s3, new GetObjectCommand(params), { expiresIn });
        return url;
    } catch (error)
    {
        throw Object.assign(new Error("Failed to generate S3 access URL"), {
            status: 500,
            code: "S3_ACCESS_URL_FAILED",
            cause: error,
        });
    }
}