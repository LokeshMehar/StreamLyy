import { Router, Request, Response, NextFunction } from "express";
import { handleSignUp, loginHandler, getAllUsers, checkAuth, getUsers } from "../controllers/auth.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

// Updated asyncHandler to properly handle return types
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) =>
    {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post("/signup", asyncHandler(handleSignUp));
router.post("/login", asyncHandler(loginHandler));
router.get("/getusers/:id", verifyJWT, asyncHandler(getAllUsers));
router.get("/getAllUsers/:id", verifyJWT, asyncHandler(getUsers));
router.get("/checkauth", asyncHandler(checkAuth));

export default router;