// src/components/Login.tsx
'use client'

import { useState } from "react"
import { Button } from "./ui/button"
import { Label } from "@radix-ui/react-label"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Toaster, toast } from "sonner"
import { Input } from "./ui/input"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import axios from 'axios';

interface LoginFormData {
    email: string;
    password: string;
}

export default function Login() {
    const router = useRouter();
    const [formData, setFormData] = useState<LoginFormData>({
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/user/login`, formData, {
                headers: {
                    "Content-Type": "application/json",
                },
                withCredentials: true
            });

            setIsLoading(false);
            toast.success("Successfully Logged In!");
            localStorage.setItem("jwtToken", response.data.token);
            localStorage.setItem("userId", response.data.user.id); // Fixed: user.id
            localStorage.setItem("username", response.data.user.username); // Fixed: user.username
            localStorage.setItem("profilePic", response.data.user.profile_pic || "");
            router.push('/home');

            console.log("Response:", response.data);
            console.log("ls userId:", localStorage.getItem('userId'));
            console.log("ls username:", localStorage.getItem('username'));
        } catch (error: any) {
            console.error("Error:", error);
            setError(error.response?.data?.message || "Invalid credentials");
            toast.error(error.response?.data?.message || "Login failed");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            <Toaster position="top-center" />
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <div className="flex w-full max-w-4xl bg-white rounded-md tracking-tight">
                    <div className="md:w-2/5 w-full flex-col justify-center p-12 items-center h-full">
                        <h2 className="text-left text-2xl font-semibold">Welcome Back!</h2>
                        <p className="text-gray-600 text-xs font-normal">Join our 100% free creative workspace.</p>

                        <Button
                            className="flex items-center px-12 mt-6 bg-white text-gray-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                        >
                            <Image src="/google.png" alt="Google logo" width={18} height={18} className="mr-2" />
                            <span className="text-sm font-medium">Sign in with Google</span>
                        </Button>

                        <div className="relative mt-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full h-px bg-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-muted-foreground">OR</span>
                            </div>
                        </div>

                        <form className="space-y-2" onSubmit={handleSubmit}>
                            <div className="space-y-1">
                                <Label className="font-semibold text-xs">Email*</Label>
                                <Input
                                    id="email"
                                    placeholder="Enter your email"
                                    required
                                    type="email"
                                    className="h-10 p-2"
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="password" className="font-semibold text-xs">
                                    Password*
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        placeholder="Enter your password"
                                        required
                                        type={showPassword ? "text" : "password"}
                                        className="h-10 p-2 pr-10"
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                                    </Button>
                                </div>
                            </div>

                            <Button className="w-full bg-black text-white mt-8 h-10" type="submit" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Please wait
                                    </>
                                ) : (
                                    "Log In"
                                )}
                            </Button>
                        </form>

                        {error && (
                            <div className="text-red-400 mt-3">{error}</div>
                        )}

                        <p className="text-sm font-light text-center mt-4">
                            Don’t have an account?{" "}
                            <span className="text-black font-bold">
                                <Link href='/signup'>Sign Up</Link>
                            </span>
                        </p>
                    </div>

                    <div className="w-3/5 relative hidden md:block">
                        <Image
                            src="/cover.jpg"
                            alt="Cover Image"
                            className="object-cover"
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority
                        />
                    </div>
                </div>
            </div>
        </>
    )
}