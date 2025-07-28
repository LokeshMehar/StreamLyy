import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";

interface CustomJwt
{
    id: string;
}

export const verifySocketJWT = async (token: string) =>
{
    try
    {
        if (!token) throw new Error("No token provided");
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as CustomJwt;
        if (!decoded.id) throw new Error("Invalid token payload");

        const existingUser = await prisma.user.findUnique({
            where: { id: decoded.id },
        });

        if (!existingUser) throw new Error("User not found");

        return { id: decoded.id };
    } catch (error)
    {
        console.error("Socket JWT verification error:", error);
        throw new Error("Invalid token");
    }
};