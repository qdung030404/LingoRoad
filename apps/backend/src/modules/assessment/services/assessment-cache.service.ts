import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export interface CacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class AssessmentCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssessmentCacheService.name);
  private redisClient: Redis | null = null;
  private isRedisConnected = false;

  /**
   * Bounded In-Memory Cache (Fallback)
   * Giới hạn tối đa 200 keys với chính sách quét dọn TTL chủ động & LRU eviction,
   * ngăn chặn triệt để nguy cơ rò rỉ bộ nhớ (Memory Leak) khi không dùng Redis.
   */
  private readonly inMemoryCache = new Map<string, CacheEntry>();
  private readonly MAX_IN_MEMORY_KEYS = 200;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>("REDIS_HOST");
    const port = Number(this.configService.get<number>("REDIS_PORT", 6379));

    // Khởi tạo timer dọn dẹp expired keys định kỳ 5 phút cho in-memory cache
    this.sweepTimer = setInterval(() => {
      this.sweepExpiredKeys();
    }, 5 * 60 * 1000);
    if (this.sweepTimer.unref) {
      this.sweepTimer.unref();
    }

    if (!host) {
      this.logger.log(
        "REDIS_HOST is not set. Operating in bounded in-memory cache mode.",
      );
      return;
    }

    try {
      this.redisClient = new Redis({
        host,
        port,
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying, fallback to in-memory
          }
          return Math.min(times * 500, 2000);
        },
      });

      this.redisClient.on("connect", () => {
        this.isRedisConnected = true;
        // Giải phóng in-memory cache ngay khi Redis đã sẵn sàng để tiết kiệm RAM
        this.inMemoryCache.clear();
        this.logger.log(`Connected to Redis cache at ${host}:${port}`);
      });

      this.redisClient.on("error", (err) => {
        this.isRedisConnected = false;
        this.logger.warn(
          `Redis cache warning: ${err.message}. Using in-memory fallback.`,
        );
      });

      this.redisClient.on("close", () => {
        this.isRedisConnected = false;
      });

      // Non-blocking connect
      this.redisClient.connect().catch((err) => {
        this.isRedisConnected = false;
        this.logger.warn(
          `Unable to connect to Redis (${host}:${port}): ${err.message}. Using in-memory fallback.`,
        );
      });
    } catch (err: unknown) {
      this.isRedisConnected = false;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis init error: ${msg}. Using in-memory fallback.`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
    }
    this.inMemoryCache.clear();
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          return JSON.parse(raw) as T;
        }
        return null;
      } catch (err) {
        this.logger.warn(
          `Redis GET failed for "${key}", fallback to memory: ${err}`,
        );
      }
    }

    const entry = this.inMemoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.inMemoryCache.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);

    // Khi Redis hoạt động, lưu độc quyền vào Redis để tránh rò rỉ và phình to RAM
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.setex(key, ttlSeconds, serialized);
        return;
      } catch (err) {
        this.logger.warn(
          `Redis SETEX failed for "${key}". Falling back to in-memory: ${err}`,
        );
      }
    }

    // In-memory fallback với kiểm soát kích thước & LRU eviction
    this.ensureCapacity();
    this.inMemoryCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.inMemoryCache.delete(key);
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err) {
        this.logger.warn(`Redis DEL failed for "${key}": ${err}`);
      }
    }
  }

  /**
   * Quét và dọn dẹp các key đã hết hạn trong in-memory cache
   */
  sweepExpiredKeys(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.inMemoryCache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Đảm bảo in-memory cache không vượt quá MAX_IN_MEMORY_KEYS
   */
  private ensureCapacity(): void {
    if (this.inMemoryCache.size >= this.MAX_IN_MEMORY_KEYS) {
      this.sweepExpiredKeys();
      // Nếu sau khi dọn expired vẫn đầy, xóa key cũ nhất (FIFO/LRU)
      while (this.inMemoryCache.size >= this.MAX_IN_MEMORY_KEYS) {
        const oldestKey = this.inMemoryCache.keys().next().value;
        if (oldestKey) {
          this.inMemoryCache.delete(oldestKey);
        } else {
          break;
        }
      }
    }
  }

  isUsingRedis(): boolean {
    return this.isRedisConnected;
  }

  getInMemorySize(): number {
    return this.inMemoryCache.size;
  }
}
