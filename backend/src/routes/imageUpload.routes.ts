import { Router, Request, Response, NextFunction } from "express";
import
    {
        generateProfilePicUploadUrl,
        generateChatImageUploadUrl,
        updateUserProfilePic,
        retrieveProfilePicUrl,
        deleteUserProfilePic,
        retrieveChatImageUrl,
    } from "../controllers/imageUpload.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
    {
        fn(req, res, next).catch(next);
    };

// Error handling middleware
const handleErrors = (err: any, req: Request, res: Response, next: NextFunction) =>
{
    console.error(`Error in ${req.method} ${req.originalUrl}:`, err);
    res.status(err.status || 500).json({
        message: err.message || "Failed to process request",
        data: { code: err.code || "UNKNOWN_ERROR" },
    });
};

// Routes
router.post("/profile-image/upload/:userId", verifyJWT, asyncHandler(generateProfilePicUploadUrl));
router.post("/chat-image/upload", verifyJWT, asyncHandler(generateChatImageUploadUrl));
router.post("/profile-image/update/:userId", verifyJWT, asyncHandler(updateUserProfilePic));
router.get("/profile-image/retrieve/:userId", asyncHandler(retrieveProfilePicUrl));
router.delete("/profile-image/:userId", verifyJWT, asyncHandler(deleteUserProfilePic));
router.post("/chat-image/retrieve", verifyJWT, asyncHandler(retrieveChatImageUrl));

// Apply error handling
router.use(handleErrors);

export default router;