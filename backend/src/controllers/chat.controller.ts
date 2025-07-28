import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { io } from "../index";

export const createChat = async (req: Request, res: Response) =>
{
  const { senderId, receiverId, name } = req.body;

  if (!senderId || !receiverId)
  {
    res.status(400).json({
      message: "Did not receive both senderId and receiverId",
    });
    return;
  }

  try
  {
    const existingChat = await prisma.chatModel.findFirst({
      where: {
        isGroup: false,
        users: { some: { userId: senderId } },
      },
      include: { users: true },
    });

    if (existingChat)
    {
      const isChatWithReceiver = existingChat.users.some(user => user.userId === receiverId);
      if (isChatWithReceiver)
      {
        res.status(200).json({
          message: "Chat already exists",
          chatId: existingChat.id,
        });
        return;
      }
    }

    const newChat = await prisma.chatModel.create({
      data: {
        name: name || null,
        isGroup: false,
      },
    });

    await prisma.chatModelUsers.createMany({
      data: [
        { userId: senderId, chatId: newChat.id },
        { userId: receiverId, chatId: newChat.id },
      ],
    });

    const chatDetails = await prisma.chatModel.findUnique({
      where: { id: newChat.id },
      include: {
        users: {
          include: {
            user: { select: { id: true, username: true, profile_pic: true } },
          },
        },
      },
    });

    const simplifiedChat = {
      id: newChat.id,
      name: newChat.name,
      isGroup: newChat.isGroup,
      latestMessage: newChat.latestMessage,
      createdAt: newChat.createdAt,
      users: chatDetails!.users.map(user => ({
        userId: user.user.id,
        username: user.user.username,
        profile_pic: user.user.profile_pic || "",
      })),
    };

    io.to(senderId).to(receiverId).emit("new-chat-added", simplifiedChat);

    res.status(201).json({
      message: "Chat created successfully",
      chatId: newChat.id,
    });
  } catch (error)
  {
    console.error("Error creating chat:", error);
    res.status(500).json({
      message: "Something went wrong while creating the chat",
      error,
    });
  }
};

export const createGroupChat = async (req: Request, res: Response) =>
{
  const { userIds, name } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0)
  {
    res.status(400).json({ message: "Invalid user id format or user id is empty" });
    return;
  }

  try
  {
    const newChat = await prisma.chatModel.create({
      data: {
        name: name || null,
        isGroup: true,
      },
    });

    await prisma.chatModelUsers.createMany({
      data: userIds.map((userId: string) => ({
        userId,
        chatId: newChat.id,
      })),
    });

    const chatDetails = await prisma.chatModel.findUnique({
      where: { id: newChat.id },
      include: {
        users: {
          include: {
            user: { select: { id: true, username: true, profile_pic: true } },
          },
        },
      },
    });

    const simplifiedChat = {
      id: newChat.id,
      name: newChat.name,
      isGroup: newChat.isGroup,
      latestMessage: newChat.latestMessage,
      createdAt: newChat.createdAt,
      users: chatDetails!.users.map(user => ({
        userId: user.user.id,
        username: user.user.username,
        profile_pic: user.user.profile_pic || "",
      })),
    };

    userIds.forEach((userId: string) =>
    {
      io.to(userId).emit("new-chat-added", simplifiedChat);
    });

    res.status(201).json({
      message: "Group chat created successfully",
      chatId: newChat.id,
    });
  } catch (error)
  {
    console.error("Error creating group chat:", error);
    res.status(500).json({
      message: "Something went wrong while creating a group chat",
      error,
    });
  }
};

export const getChats = async (req: Request, res: Response) =>
{
  const { id } = req.params;
  try
  {
    const chats = await prisma.chatModel.findMany({
      where: {
        users: { some: { userId: id } },
      },
      include: {
        users: {
          include: {
            user: { select: { username: true, id: true, profile_pic: true } },
          },
        },
      },
    });

    const simplifiedChats = chats.map(chat => ({
      id: chat.id,
      name: chat.name,
      isGroup: chat.isGroup,
      latestMessage: chat.latestMessage,
      createdAt: chat.createdAt,
      users: chat.users.map(user => ({
        userId: user.user.id,
        username: user.user.username,
        profile_pic: user.user.profile_pic || "",
      })),
    }));

    res.status(200).json({
      message: "chats fetched successfully",
      data: simplifiedChats,
    });
  } catch (error)
  {
    console.log("This is my error", error);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};