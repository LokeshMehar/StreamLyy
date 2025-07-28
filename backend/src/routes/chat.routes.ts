import { Router } from "express";
import { createChat, createGroupChat, getChats } from "../controllers/chat.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.post("/singlechat", verifyJWT, createChat);
router.post("/groupchat", verifyJWT, createGroupChat);
router.get("/getchats/:id", verifyJWT, getChats);



export default router;  