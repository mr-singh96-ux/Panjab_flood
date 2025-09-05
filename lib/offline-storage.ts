interface CachedData {
  data: any
  timestamp: number
  expiry?: number
}

class OfflineStorageManager {
  private static instance: OfflineStorageManager
  private readonly CACHE_PREFIX = "flood_coordination_cache_"
  private readonly DEFAULT_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB limit

  private constructor() {}

  static getInstance(): OfflineStorageManager {
    if (!OfflineStorageManager.instance) {
      OfflineStorageManager.instance = new OfflineStorageManager()
    }
    return OfflineStorageManager.instance
  }

  set(key: string, data: any, expiryMs?: number): void {
    try {
      const cachedData: CachedData = {
        data,
        timestamp: Date.now(),
        expiry: expiryMs ? Date.now() + expiryMs : Date.now() + this.DEFAULT_EXPIRY,
      }

      const serialized = JSON.stringify(cachedData)

      if (this.getCacheSize() + serialized.length > this.MAX_CACHE_SIZE) {
        this.cleanupOldCache()
      }

      localStorage.setItem(this.CACHE_PREFIX + key, serialized)
    } catch (error) {
      console.error("[v0] Error caching data:", error)
      this.cleanupOldCache()
      try {
        localStorage.setItem(
          this.CACHE_PREFIX + key,
          JSON.stringify({
            data,
            timestamp: Date.now(),
            expiry: expiryMs ? Date.now() + expiryMs : Date.now() + this.DEFAULT_EXPIRY,
          }),
        )
      } catch (retryError) {
        console.error("[v0] Failed to cache data after cleanup:", retryError)
      }
    }
  }

  get(key: string): any | null {
    try {
      const stored = localStorage.getItem(this.CACHE_PREFIX + key)
      if (!stored) return null

      const cachedData: CachedData = JSON.parse(stored)

      if (cachedData.expiry && Date.now() > cachedData.expiry) {
        this.remove(key)
        return null
      }

      return cachedData.data
    } catch (error) {
      console.error("[v0] Error retrieving cached data:", error)
      return null
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.CACHE_PREFIX + key)
    } catch (error) {
      console.error("[v0] Error removing cached data:", error)
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.CACHE_PREFIX))
      keys.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      console.error("[v0] Error clearing cache:", error)
    }
  }

  cacheUserRequests(userId: string, requests: any[]): void {
    this.set(`user_requests_${userId}`, requests)
  }

  getCachedUserRequests(userId: string): any[] | null {
    return this.get(`user_requests_${userId}`)
  }

  cacheVolunteers(volunteers: any[]): void {
    this.set("volunteers", volunteers)
  }

  getCachedVolunteers(): any[] | null {
    return this.get("volunteers")
  }

  cacheUserMessages(userId: string, messages: any[]): void {
    this.set(`user_messages_${userId}`, messages)
  }

  getCachedUserMessages(userId: string): any[] | null {
    return this.get(`user_messages_${userId}`)
  }

  private getCacheSize(): number {
    let totalSize = 0
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          totalSize += localStorage.getItem(key)?.length || 0
        }
      })
    } catch (error) {
      console.error("[v0] Error calculating cache size:", error)
    }
    return totalSize
  }

  private cleanupOldCache(): void {
    try {
      const cacheEntries: Array<{ key: string; timestamp: number; size: number }> = []

      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          const stored = localStorage.getItem(key)
          if (stored) {
            try {
              const cachedData: CachedData = JSON.parse(stored)
              cacheEntries.push({
                key,
                timestamp: cachedData.timestamp,
                size: stored.length,
              })
            } catch (parseError) {
              localStorage.removeItem(key)
            }
          }
        }
      })

      cacheEntries.sort((a, b) => a.timestamp - b.timestamp)
      const toRemove = Math.ceil(cacheEntries.length * 0.25)

      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(cacheEntries[i].key)
      }

      console.log(`[v0] Cleaned up ${toRemove} old cache entries`)
    } catch (error) {
      console.error("[v0] Error during cache cleanup:", error)
    }
  }

  searchCachedRequests(userId: string, searchTerm: string): any[] | null {
    const requests = this.getCachedUserRequests(userId)
    if (!requests || !searchTerm) return requests

    return requests.filter(
      (request) =>
        request.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.status?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }

  getCacheStats() {
    const totalSize = this.getCacheSize()
    const entries = Object.keys(localStorage).filter((key) => key.startsWith(this.CACHE_PREFIX)).length

    return {
      totalSize,
      totalEntries: entries,
      maxSize: this.MAX_CACHE_SIZE,
      usagePercentage: Math.round((totalSize / this.MAX_CACHE_SIZE) * 100),
    }
  }
}

export default OfflineStorageManager
