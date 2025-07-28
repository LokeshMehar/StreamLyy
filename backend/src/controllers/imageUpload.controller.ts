import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma";
import { generateUploadUrl, generateAccessUrl } from "../utils/s3upload";
import { v4 as uuid } from "uuid";
import { validateFileType, sanitizeS3Key } from "../utils/validation";

// Define custom error type for better error handling
interface CustomError extends Error
{
    status?: number;
    code?: string;
}

export const generateProfilePicUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> =>
{
    try
    {
        const { userId } = req.params;
        const { fileType } = req.query;

        if (!validateFileType(fileType as string))
        {
            const error: CustomError = new Error("Invalid or missing file type");
            error.status = 400;
            error.code = "INVALID_FILE_TYPE";
            throw error;
        }

        // Verify user exists and matches authenticated user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
        {
            const error: CustomError = new Error("User not found");
            error.status = 404;
            error.code = "USER_NOT_FOUND";
            throw error;
        }
        if (user.id !== (req as any).user.id)
        {
            const error: CustomError = new Error("Unauthorized to upload for this user");
            error.status = 403;
            error.code = "UNAUTHORIZED";
            throw error;
        }

        const uploadUrl = await generateUploadUrl("profile_pics/", `profile_pic_${userId}`, fileType as string);

        res.status(200).json({
            message: "Profile picture upload URL generated successfully",
            data: { uploadUrl },
        });
    } catch (error)
    {
        next(error);
    }
};

export const generateChatImageUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> =>
{
    try
    {
        const fileType = (req.query.fileType as string) || "image/jpeg";
        if (!validateFileType(fileType))
        {
            const error: CustomError = new Error("Invalid file type");
            error.status = 400;
            error.code = "INVALID_FILE_TYPE";
            throw error;
        }

        const extension = fileType.split("/")[1] || "jpeg";
        const imageName = `${uuid()}.${extension}`;
        const uploadUrl = await generateUploadUrl("chat_pics/", imageName, fileType);

        res.status(200).json({
            message: "Chat image upload URL generated successfully",
            data: {
                uploadUrl,
                imageKey: `chat_pics/${imageName}`,
            },
        });
    } catch (error)
    {
        next(error);
    }
};

export const updateUserProfilePic = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> =>
{
    try
    {
        const { userId } = req.params;
        const { imageKey } = req.body;

        if (!imageKey || !sanitizeS3Key(imageKey))
        {
            const error: CustomError = new Error("Invalid or missing image key");
            error.status = 400;
            error.code = "INVALID_IMAGE_KEY";
            throw error;
        }

        // Verify user exists and matches authenticated user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
        {
            const error: CustomError = new Error("User not found");
            error.status = 404;
            error.code = "USER_NOT_FOUND";
            throw error;
        }
        if (user.id !== (req as any).user.id)
        {
            const error: CustomError = new Error("Unauthorized to update this user");
            error.status = 403;
            error.code = "UNAUTHORIZED";
            throw error;
        }

        // Store the image key
        await prisma.user.update({
            where: { id: userId },
            data: { profile_pic: imageKey },
        });

        const accessUrl = await generateAccessUrl(imageKey);

        res.status(200).json({
            message: "Profile picture updated successfully",
            data: { accessUrl },
        });
    } catch (error)
    {
        next(error);
    }
};

export const retrieveProfilePicUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> =>
{
    try
    {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
        {
            const error: CustomError = new Error("User not found");
            error.status = 404;
            error.code = "USER_NOT_FOUND";
            throw error;
        }
        if (!user.profile_pic)
        {
            const error: CustomError = new Error("No profile picture found");
            error.status = 404;
            error.code = "NO_PROFILE_PIC";
            throw error;
        }

        const accessUrl = await generateAccessUrl(user.profile_pic);

        res.status(200).json({
            message: "Profile picture URL retrieved successfully",
            data: { accessUrl },
        });
    } catch (error)
    {
        next(error);
    }
};

export const deleteUserProfilePic = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> =>
{
    try
    {
        const { userId } = req.params;

        // Verify user exists and matches authenticated user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
        {
            const error: CustomError = new Error("User not found");
            error.status = 404;
            error.code = "USER_NOT_FOUND";
            throw error;
        }
        if (user.id !== (req as any).user.id)
        {
            const error: CustomError = new Error("Unauthorized to delete this user’s profile picture");
            error.status = 403;
            error.code = "UNAUTHORIZED";
            throw error;
        }

        // Update database to remove profile picture
        await prisma.user.update({
            where: { id: userId },
            data: { profile_pic: null },
        });

        res.status(200).json({
            message: "Profile picture deleted successfully",
            data: {},
        });
    } catch (error)
    {
        next(error);
    }
};

export const retrieveChatImageUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> =>
{
    try
    {
        const { key } = req.body; // Changed from req.params to req.body
        const sanitizedKey = sanitizeS3Key(key);
        if (!sanitizedKey)
        {
            const error: CustomError = new Error("Invalid image key");
            error.status = 400;
            error.code = "INVALID_IMAGE_KEY";
            throw error;
        }

        const accessUrl = await generateAccessUrl(sanitizedKey);

        res.status(200).json({
            message: "Chat image URL retrieved successfully",
            data: { accessUrl },
        });
    } catch (error)
    {
        next(error);
    }
};