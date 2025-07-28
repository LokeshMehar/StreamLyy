import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import prisma from '../utils/prisma';

// Define custom JWT payload interface
interface CustomJwt extends JwtPayload
{
    id: string;
}


export const verifyJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> =>
{
    const token = req.header('Authorization')?.split(' ')[1] || req.cookies.jwtToken;

    if (!token)
    {
        res.status(401).json({ message: 'Incoming token not found' });
        return; // Don't use return res.status()...
    }

    try
    {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as CustomJwt;

        const existingUser = await prisma.user.findUnique({
            where: {
                id: decodedToken.id,
            },
        });

        if (!existingUser)
        {
            res.status(401).json({ message: 'User not found' });
            return; // Don't use return res.status()...
        }

        (req as any).user = existingUser;
        next();
    } catch (e)
    {
        res.status(401).json({ message: 'Invalid token' });
        return; // Don't use return res.status()...
    }
};