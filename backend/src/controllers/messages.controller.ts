import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { MessageType } from "@prisma/client";

export const getMessagesByChatId = async (req: Request, res: Response) =>
{
  const { id, incomingUserId } = req.params;
  console.log("incoming user id", incomingUserId);
  console.log("This is my id", id);

  const chatModel = await prisma.chatModel.findUnique({
    where: { id },
  });

  if (!chatModel)
  {
    res.json({ message: "Chat with this id does not exists" });
    return;
  }

  try
  {
    const messages = await prisma.message.findMany({
      where: {
        chatId: id,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile_pic: true,
          },
        },
      },
    });

    const chat = await prisma.chatModel.findFirst({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        isGroup: true,
        createdAt: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile_pic: true,
                email: true,
              },
            },
          },
        },
      },
    });

    console.log("The chat details are ", chat);

    if (chat?.isGroup === false || chat?.name === null)
    {
      const filteredChat = chat.users.filter((user) => user.userId !== incomingUserId);
      console.log("Filtered Chat is ", filteredChat);
      const chatName = filteredChat[0]?.user.username;
      const newChat = { ...chat, name: chatName };

      console.log("This is my new chat", newChat);

      res.status(200).json({
        message: "Successfully fetched the chat messages",
        data: messages,
        chatDetails: newChat,
      });
      return;
    }

    res.status(200).json({
      message: "Successfully fetched the chat messages",
      data: messages,
      chatDetails: chat,
    });
  } catch (error)
  {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      message: "Something went wrong while fetching the messages",
      error,
    });
  }
};

export const saveMessage = async (req: Request, res: Response) =>
{
  const { senderId, content, chatId, type, imageUrl } = req.body;

  if (((!senderId || !content || !chatId || !type) && !imageUrl) || !["IMAGE", "TEXT", "CALL"].includes(type))
  {
    console.log("Invalid message data");
    res.status(400).json({ message: "Invalid message data" });
    return;
  }

  try
  {
    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        chatId,
        type: type as MessageType,
        imageUrl: imageUrl || null,
      },
      include: {
        user: { select: { id: true, username: true, profile_pic: true } },
      },
    });

    await prisma.chatModel.update({
      where: { id: chatId },
      data: { latestMessage: type === "TEXT" ? content : null },
    });

    console.log("Message saved successfully");
    res.status(200).json({
      message: "Message saved successfully",
      data: message,
    });
  } catch (error)
  {
    console.error("Something went wrong while saving the message", error);
    res.status(500).json({
      message: "Something went wrong while saving message",
      error,
    });
  }
};