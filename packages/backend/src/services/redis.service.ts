import Redis from 'ioredis';
import { config } from '../config/index.js';
import logger from '../lib/logger.js';

let redisClient: Redis | null = null;

/**
 * Redis Service for caching and rate limiting
 */
export class RedisService {
  /**
   * Get the Redis client (singleton)
   */
  static getClient(): Redis {
    if (!redisClient) {
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
      });

      redisClient.on('error', (err) => {
        logger.error('Redis connection error:', err);
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected');
      });

      redisClient.on('close', () => {
        logger.warn('Redis connection closed');
      });
    }
    return redisClient;
  }

  /**
   * Check if Redis is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a value from Redis
   */
  static async get(key: string): Promise<string | null> {
    try {
      return await this.getClient().get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  /**
   * Set a value in Redis
   */
  static async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.getClient().setex(key, ttlSeconds, value);
      } else {
        await this.getClient().set(key, value);
      }
    } catch (error) {
      logger.error('Redis SET error:', error);
    }
  }

  /**
   * Increment a counter
   */
  static async incr(key: string): Promise<number> {
    try {
      return await this.getClient().incr(key);
    } catch (error) {
      logger.error('Redis INCR error:', error);
      return 0;
    }
  }

  /**
   * Set expiration on a key
   */
  static async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.getClient().expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
    }
  }

  /**
   * Delete a key
   */
  static async del(key: string): Promise<void> {
    try {
      await this.getClient().del(key);
    } catch (error) {
      logger.error('Redis DEL error:', error);
    }
  }

  /**
   * Get TTL of a key
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await this.getClient().ttl(key);
    } catch (error) {
      logger.error('Redis TTL error:', error);
      return -1;
    }
  }

  /**
   * Close the Redis connection
   */
  static async close(): Promise<void> {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    }
  }
}
