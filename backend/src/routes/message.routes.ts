import { Router } from "express";
import { getMessagesByChatId, saveMessage } from "../controllers/messages.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/getmessages/:id/:incomingUserId", verifyJWT, getMessagesByChatId);
router.post("/send-message", verifyJWT, saveMessage);

export default router; 