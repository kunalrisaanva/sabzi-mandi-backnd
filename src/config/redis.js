import { Redis } from '@upstash/redis';
import { createClient } from 'redis';

let redisClient = null;

const connectRedis = async () => {
    try {
        // Check if Upstash credentials are provided (for production/Render)
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            console.log('Connecting to Upstash Redis...');
            redisClient = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN,
            });

            // Test connection
            await redisClient.ping();
            console.log('Upstash Redis Connected');
        }
        // Otherwise use local Redis (for development)
        else {
            console.log('Connecting to Local Redis...');
            redisClient = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            redisClient.on('error', (err) => {
                console.error('Redis Client Error:', err);
            });

            redisClient.on('connect', () => {
                console.log('Local Redis Connected');
            });

            await redisClient.connect();
        }

        return redisClient;
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        throw error;
    }
};

const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call connectRedis() first.');
    }
    return redisClient;
};

export { connectRedis, getRedisClient };
