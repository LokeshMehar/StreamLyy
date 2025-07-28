// src/components/CreateGroupDialog.tsx
"use client";

import { Check, Loader2, Users } from "lucide-react";
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

type CreateGroupDialogProps = {
  setFetchAgain: React.Dispatch<SetStateAction<boolean>>;
};

export function CreateGroupDialog({ setFetchAgain }: CreateGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([localStorage.getItem("userId") || ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      userIds: selectedUsers,
      name: groupName,
      isGroup: selectedUsers.length > 2,
    };

    try {
      setIsLoading(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/chat/create`,
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("jwtToken")}`,
          },
          withCredentials: true,
        }
      );
      setIsLoading(false);
      setFetchAgain(true);
      toast.success("Chat created successfully");
      console.log("Response", response.data);
      setOpen(false);
    } catch (error: any) {
      setIsLoading(false);
      console.error("Error creating chat", error);
      toast.error(error.response?.data?.message || "Failed to create chat");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  useEffect(() => {
    setIsLoading(true);
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("jwtToken");
    if (!userId || !token) {
      toast.error("Please log in");
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
        console.error("Error fetching users", error);
        toast.error("Failed to fetch users");
        setIsLoading(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Users className="h-5 w-5" />
          <span className="sr-only">Create chat</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Chat</DialogTitle>
            <DialogDescription>Create a new chat by adding a name and selecting members.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Chat Name</Label>
              <Input
                id="name"
                placeholder="Enter chat name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid gap-2">
              <Label>Select Members</Label>
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
                          selectedUsers.includes(user.id) && "bg-accent"
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
                        {selectedUsers.includes(user.id) && <Check className="h-5 w-5 text-primary" />}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!groupName.trim() || selectedUsers.length < 2 || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}