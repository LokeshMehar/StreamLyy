// src/components/CreateSingleChatDialog.tsx
"use client";

import { Check, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetStateAction, useEffect, useState } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Person {
  id: string;
  username: string;
  email: string;
  profile_pic?: string;
}

type CreateSingleChatDialogProps = {
  setFetchAgain: React.Dispatch<SetStateAction<boolean>>;
};

export function CreateSingleChatDialog({ setFetchAgain }: CreateSingleChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [chatName, setChatName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUserId = localStorage.getItem("userId");
    const token = localStorage.getItem("jwtToken");

    if (!currentUserId || !token) {
      toast.error("Please log in");
      return;
    }

    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    const dataToSend = {
      senderId: currentUserId,
      receiverId: selectedUserId,
      name: chatName || null,
    };

    try {
      setIsLoading(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/chat/singlechat`,
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          withCredentials: true,
        }
      );
      setIsLoading(false);
      setFetchAgain(true);
      toast.success(response.data.message);
      console.log("Response:", response.data);
      setOpen(false);
      setChatName("");
      setSelectedUserId(null);
    } catch (error: any) {
      setIsLoading(false);
      console.error("Error creating chat:", error);
      toast.error(error.response?.data?.message || "Failed to create chat");
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserId(userId === selectedUserId ? null : userId);
  };

  useEffect(() => {
    setIsLoading(true);
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("jwtToken");
    if (!userId || !token) {
      toast.error("Please log in");
      setIsLoading(false);
      return;
    }
    axios
      .get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/user/getAllUsers/${userId}`, {
        headers: { "Authorization": `Bearer ${token}` },
        withCredentials: true,
      })
      .then((res) => {
        setPeople(res.data.data || []);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching users:", error);
        toast.error("Failed to fetch users");
        setIsLoading(false);
      });
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <User className="h-5 w-5" />
          <span className="sr-only">Create 1:1 chat</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create 1:1 Chat</DialogTitle>
            <DialogDescription>Select one user to start a private chat.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Chat Name (Optional)</Label>
              <Input
                id="name"
                placeholder="Enter chat name"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid gap-2">
              <Label>Select User</Label>
              <ScrollArea className="h-[200px] rounded-md border p-2">
                <div className="space-y-2">
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  ) : (
                    people.map((user) => (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center space-x-3 rounded-md p-2 cursor-pointer hover:bg-accent",
                          selectedUserId === user.id && "bg-accent"
                        )}
                        onClick={() => toggleUser(user.id)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profile_pic} alt={user.username} />
                          <AvatarFallback>
                            {user.username.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">{user.username}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        {selectedUserId === user.id && <Check className="h-5 w-5 text-primary" />}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!selectedUserId || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}