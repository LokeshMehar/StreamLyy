"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { io } from "socket.io-client"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar"
import { Menu, User } from "lucide-react"
import { cn } from "@/lib/utils"
import FilterTabs from "./FilterTabs"
import { PeopleSheet } from "./SearchSheet"
import { CreateGroupDialog } from "./CreateGroupDialog"
import { CreateSingleChatDialog } from "./CreateSingleChatDialog"

interface ChatsType {
  id: string
  name: string | null
  isGroup: boolean
  latestMessage: string | null
  createdAt: Date
  users: UserDetailsType[]
}

interface UserDetailsType {
  userId: string
  username: string
  profile_pic: string
}

type LeftBarProps = {
  selectedChat: string
  setSelectedChat: React.Dispatch<React.SetStateAction<string>>
}

export default function LeftBar({ selectedChat, setSelectedChat }: LeftBarProps) {
  const socket = useMemo(
    () =>
      io(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}`, {
        auth: { token: localStorage.getItem("jwtToken") },
        withCredentials: true,
      }),
    [],
  )

  const [chats, setChats] = useState<ChatsType[]>([])
  const [fetchAgain, setFetchAgain] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem("userId")
    const token = localStorage.getItem("jwtToken")
    if (!userId || !token) {
      toast.error("Please log in")
      return
    }

    console.log("Connecting to socket at:", process.env.NEXT_PUBLIC_BACKEND_URL)
    socket.emit("join-user", userId)
    socket.emit("get-chats", userId)

    socket.on("get-all-chats", (chats: ChatsType[]) => {
      console.log("Received chats:", chats)
      setChats(chats)
    })

    socket.on("new-chat-added", (newChat: ChatsType) => {
      console.log("New chat added:", newChat)
      setChats((prev) => {
        if (prev.some((chat) => chat.id === newChat.id)) return prev
        const updatedChat = { ...newChat, name: getOtherUserName(newChat) }
        return [...prev, updatedChat]
      })
    })

    socket.on("error", (error: { message: string }) => {
      console.error("Socket error:", error.message)
      toast.error(error.message)
    })

    return () => {
      socket.off("get-all-chats")
      socket.off("new-chat-added")
      socket.off("error")
      socket.disconnect()
    }
  }, [socket, fetchAgain])

  const getOtherUserName = (chat: ChatsType) => {
    if (chat.isGroup || chat.name) return chat.name
    const userId = localStorage.getItem("userId")
    const otherUser = chat.users.find((user) => user.userId !== userId)
    return otherUser?.username || ""
  }

  const getOtherProfilePic = (chat: ChatsType) => {
    if (chat.isGroup) return null
    const userId = localStorage.getItem("userId")
    const otherUser = chat.users.find((user) => user.userId !== userId)
    return otherUser?.profile_pic || null
  }

  const convertTimeToReadableFormat = (time: Date) => {
    const date = new Date(time)
    let hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? "PM" : "AM"
    hours = hours % 12 || 12
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes
    return `${hours}:${formattedMinutes} ${ampm}`
  }

  console.log("Chats:", chats)

  return (
    <div className="p-5 w-full bg-white h-screen overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Avatar className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
            <AvatarImage
              src={ ""}
              alt="User Profile"
              className="h-full w-full object-cover"
            />
            <AvatarFallback className="absolute inset-0 flex items-center justify-center text-center font-semibold text-white bg-gradient-to-br from-blue-500 to-indigo-600">
              {localStorage.getItem("username")?.slice(0, 2).toUpperCase() || "AB"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col justify-center">
            <h2 className="text-md font-semibold tracking-tight">{localStorage.getItem("username")}</h2>
            <p className="text-xs text-gray-500">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PeopleSheet socket={socket} sendChatToParent={setChats} />
          <CreateSingleChatDialog setFetchAgain={setFetchAgain} />
          <CreateGroupDialog setFetchAgain={setFetchAgain} />
        </div>
      </div>

      <div className="mb-4">
        <FilterTabs />
      </div>

      <div className="mt-2 flex-1 overflow-y-auto pr-1">
        <p className="text-xs font-medium uppercase text-gray-500 mb-3 tracking-wider">Messages</p>
        <div className="space-y-2">
          {chats.length === 0 ? (
            <p className="text-sm text-gray-500">No chats available</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "flex justify-between items-center p-3 rounded-xl transition-all duration-200 cursor-pointer",
                  selectedChat === chat.id
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 shadow-sm"
                    : "hover:bg-gray-50"
                )}
                onClick={() => setSelectedChat(chat.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center rounded-full overflow-hidden border border-gray-200 shadow-sm">
                    {getOtherProfilePic(chat) ? (
                      <img className="w-full h-full object-cover" src={getOtherProfilePic(chat)!} alt="Profile" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold">
                        {getOtherUserName(chat)?.slice(0, 2).toUpperCase() || "BC"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-sm font-medium tracking-tight">{getOtherUserName(chat)}</h2>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {chat.latestMessage && chat.latestMessage.length > 25
                        ? chat.latestMessage.slice(0, 25) + "..."
                        : chat.latestMessage || "No messages yet"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-xs font-medium text-gray-500">{convertTimeToReadableFormat(chat.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}