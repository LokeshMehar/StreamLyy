import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

export const pubClient = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD || 'lokeshm-redis',
    socket: {
        host: process.env.REDIS_HOST || 'lokeshm-redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
});

export const subClient = pubClient.duplicate();

export const connectRedis = async () =>
{
    try
    {
        if (!pubClient.isOpen) await pubClient.connect();
        if (!subClient.isOpen) await subClient.connect();
        console.log("Pub Sub Connected!");
    } catch (error)
    {
        console.error("Error connecting to Redis:", error);
        throw error;
    }
};

pubClient.on('error', (err) => console.error('Redis Client Error:', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));





