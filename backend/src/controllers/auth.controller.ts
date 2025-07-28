import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const prisma = new PrismaClient();

export const handleSignUp = async (req: Request, res: Response): Promise<Response> =>
{
  try
  {
    const { email, password, username, profile_pic } = req.body;

    if (!email || !password || !username)
    {
      return res.status(400).json({ message: 'Email, password, and username are required' });
    }

    const userExists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (userExists)
    {
      return res.status(409).json({ message: 'User with this email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
        profile_pic: profile_pic || null,
      },
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your-jwt-secret', {
      expiresIn: '7h',
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile_pic: user.profile_pic,
      },
      token,
    });
  } catch (error)
  {
    console.error('Signup error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    {
      return res.status(409).json({ message: 'Username or email already exists' });
    }
    return res.status(500).json({ message: 'Something went wrong while registering the user' });
  }
};

export const loginHandler = async (req: Request, res: Response): Promise<Response> =>
{
  try
  {
    const { email, password } = req.body;

    if (!email || !password)
    {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user)
    {
      return res.status(401).json({ message: 'User with this email does not exist' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid)
    {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your-jwt-secret', {
      expiresIn: '7h',
    });

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Secure in production
    };

    return res
      .status(200)
      .cookie('jwtToken', token, options)
      .json({
        message: 'User logged in successfully',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          profile_pic: user.profile_pic,
        },
      });
  } catch (error)
  {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const checkAuth = async (req: Request, res: Response): Promise<Response> =>
{
  try
  {
    const token = req.cookies.jwtToken;

    if (!token)
    {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret') as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, email: true, profile_pic: true },
    });

    if (!user)
    {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    return res.status(200).json({
      message: 'Authenticated',
      user,
    });
  } catch (error)
  {
    console.error('Auth check error:', error);
    return res.status(401).json({ message: 'Unauthorized: Token verification failed' });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<Response> =>
{
  try
  {
    const { id } = req.params;

    if (!id)
    {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: id },
      },
      select: {
        id: true,
        username: true,
        email: true,
        profile_pic: true,
      },
    });

    const userChats = await prisma.chatModel.findMany({
      where: {
        isGroup: false,
        users: {
          some: {
            userId: id,
          },
        },
      },
      include: {
        users: {
          select: {
            userId: true,
          },
        },
      },
    });

    const usersToBeFiltered = userChats.flatMap((chat) =>
      chat.users.filter((user) => user.userId !== id).map((user) => user.userId),
    );

    const filteredUsers = users.filter((user) => !usersToBeFiltered.includes(user.id));

    return res.status(200).json({
      message: 'Users fetched successfully',
      data: filteredUsers,
    });
  } catch (error)
  {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Something went wrong while fetching users' });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<Response> =>
{
  try
  {
    const { id } = req.params;

    if (!id)
    {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: id },
      },
      select: {
        id: true,
        username: true,
        profile_pic: true,
        email: true,
      },
    });

    return res.status(200).json({
      message: 'Users fetched successfully',
      data: users,
    });
  } catch (error)
  {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const health = async (req: Request, res: Response): Promise<Response> =>
{
  try
  {
    const token = (req as any).user; // Assumes middleware sets req.user
    console.log('Fetched token:', token);
    return res.status(200).json({ message: 'Health check passed' });
  } catch (error)
  {
    console.error('Health check error:', error);
    return res.status(500).json({ message: 'Health check failed' });
  }
};