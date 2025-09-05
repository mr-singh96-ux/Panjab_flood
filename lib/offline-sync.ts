interface OfflineAction {
  id: string
  table: string
  action: "insert" | "update" | "delete"
  data: any
  timestamp: number
  userId: string
  retryCount?: number
  priority?: "high" | "medium" | "low"
  lastAttempt?: number
}

class OfflineSyncManager {
  private static instance: OfflineSyncManager
  private isOnline: boolean = navigator.onLine
  private syncQueue: OfflineAction[] = []
  private readonly STORAGE_KEY = "flood_coordination_offline_queue"
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000 // Base delay in ms

  private constructor() {
    this.loadQueueFromStorage()
    this.setupEventListeners()
    this.cleanupInvalidUUIDs()
  }

  static getInstance(): OfflineSyncManager {
    if (!OfflineSyncManager.instance) {
      OfflineSyncManager.instance = new OfflineSyncManager()
    }
    return OfflineSyncManager.instance
  }

  private setupEventListeners() {
    window.addEventListener("online", () => {
      console.log("[v0] Connection restored, syncing offline data...")
      this.isOnline = true
      this.syncOfflineData()
    })

    window.addEventListener("offline", () => {
      console.log("[v0] Connection lost, switching to offline mode")
      this.isOnline = false
    })
  }

  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        this.syncQueue = JSON.parse(stored)
      }
    } catch (error) {
      console.error("[v0] Error loading offline queue:", error)
      this.syncQueue = []
    }
  }

  private saveQueueToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.syncQueue))
    } catch (error) {
      console.error("[v0] Error saving offline queue:", error)
    }
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  private cleanupInvalidUUIDs() {
    const originalLength = this.syncQueue.length

    this.syncQueue = this.syncQueue.filter((action) => {
      if (action.data && action.data.id && !this.isValidUUID(action.data.id)) {
        console.log(`[v0] Removing invalid UUID from offline queue: ${action.data.id}`)
        return false
      }

      if (action.data && action.data.anonymous_victim_id && !this.isValidUUID(action.data.anonymous_victim_id)) {
        console.log(`[v0] Removing invalid anonymous_victim_id from offline queue: ${action.data.anonymous_victim_id}`)
        return false
      }

      return true
    })

    if (originalLength !== this.syncQueue.length) {
      console.log(`[v0] Cleaned up ${originalLength - this.syncQueue.length} invalid UUIDs from offline queue`)
      this.saveQueueToStorage()
    }
  }

  addToQueue(
    table: string,
    action: "insert" | "update" | "delete",
    data: any,
    userId: string,
    priority: "high" | "medium" | "low" = "medium",
  ) {
    if (data && data.id && !this.isValidUUID(data.id)) {
      console.error(`[v0] Invalid UUID format, not adding to queue: ${data.id}`)
      return
    }

    if (data && data.anonymous_victim_id && !this.isValidUUID(data.anonymous_victim_id)) {
      console.error(`[v0] Invalid anonymous_victim_id UUID format, not adding to queue: ${data.anonymous_victim_id}`)
      return
    }

    const offlineAction: OfflineAction = {
      id: window.crypto.randomUUID(),
      table,
      action,
      data: {
        ...data,
        offline_created_at: new Date().toISOString(),
        offline_updated_at: new Date().toISOString(),
      },
      timestamp: Date.now(),
      userId,
      priority,
      retryCount: 0,
    }

    this.syncQueue.push(offlineAction)
    this.syncQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority || "medium"] - priorityOrder[a.priority || "medium"]
    })

    this.saveQueueToStorage()

    console.log(`[v0] Added ${action} on ${table} to offline queue with ${priority} priority`)

    if (this.isOnline) {
      this.syncOfflineData()
    }
  }

  async syncOfflineData() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return
    }

    console.log(`[v0] Syncing ${this.syncQueue.length} offline actions...`)

    const { createClient } = await import("./supabase/client")
    const supabase = createClient()

    const successfulSyncs: string[] = []
    const failedSyncs: OfflineAction[] = []

    for (const action of this.syncQueue) {
      try {
        let result

        const syncData = { ...action.data }
        delete syncData.offline_created_at
        delete syncData.offline_updated_at

        switch (action.action) {
          case "insert":
            result = await supabase.from(action.table).insert(syncData)
            break
          case "update":
            if (action.table === "volunteers" && !syncData.id) {
              if (syncData.anonymous_volunteer_id) {
                result = await supabase
                  .from(action.table)
                  .update(syncData)
                  .eq("anonymous_volunteer_id", syncData.anonymous_volunteer_id)
              } else {
                console.log(`[v0] Skipping volunteer update without valid identifier`)
                successfulSyncs.push(action.id)
                continue
              }
            } else {
              const { data: existingData } = await supabase
                .from(action.table)
                .select("updated_at")
                .eq("id", syncData.id)
                .single()

              if (existingData && action.data.offline_updated_at) {
                const existingTime = new Date(existingData.updated_at).getTime()
                const offlineTime = new Date(action.data.offline_updated_at).getTime()

                if (existingTime > offlineTime) {
                  console.log(`[v0] Conflict detected for ${action.table}:${syncData.id}, skipping update`)
                  successfulSyncs.push(action.id)
                  continue
                }
              }

              result = await supabase.from(action.table).update(syncData).eq("id", syncData.id)
            }
            break
          case "delete":
            result = await supabase.from(action.table).delete().eq("id", syncData.id)
            break
        }

        if (result?.error) {
          console.error(`[v0] Sync error for ${action.action} on ${action.table}:`, result.error)

          action.retryCount = (action.retryCount || 0) + 1
          action.lastAttempt = Date.now()

          if (action.retryCount < this.MAX_RETRIES) {
            failedSyncs.push(action)
          } else {
            console.error(`[v0] Max retries exceeded for action ${action.id}, removing from queue`)
            successfulSyncs.push(action.id)
          }
        } else {
          console.log(`[v0] Successfully synced ${action.action} on ${action.table}`)
          successfulSyncs.push(action.id)

          try {
            const recordId = syncData.id || syncData.anonymous_volunteer_id || action.id
            await supabase.from("offline_sync").insert({
              user_id: action.userId,
              anonymous_user_id: action.userId, // Store as anonymous_user_id for non-authenticated users
              table_name: action.table,
              record_id: recordId,
              action: action.action,
              data: syncData,
              synced: true,
            })
          } catch (syncLogError) {
            console.warn("[v0] Could not log sync to database:", syncLogError)
          }
        }
      } catch (error) {
        console.error(`[v0] Network error syncing ${action.action} on ${action.table}:`, error)

        action.retryCount = (action.retryCount || 0) + 1
        action.lastAttempt = Date.now()

        if (action.retryCount < this.MAX_RETRIES) {
          failedSyncs.push(action)
        } else {
          successfulSyncs.push(action.id)
        }
      }
    }

    this.syncQueue = failedSyncs.filter((action) => {
      const delay = this.RETRY_DELAY * Math.pow(2, (action.retryCount || 0) - 1)
      return !action.lastAttempt || Date.now() - action.lastAttempt >= delay
    })

    this.saveQueueToStorage()

    console.log(`[v0] Sync complete. ${successfulSyncs.length} actions synced, ${this.syncQueue.length} remaining`)

    if (
      failedSyncs.length > 0 &&
      "serviceWorker" in navigator &&
      "sync" in window.ServiceWorkerRegistration.prototype
    ) {
      try {
        const registration = await navigator.serviceWorker.ready
        await registration.sync.register("flood-coordination-sync")
        console.log("[v0] Background sync registered for failed actions")
      } catch (error) {
        console.warn("[v0] Could not register background sync:", error)
      }
    }
  }

  getQueueStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      oldestAction: this.syncQueue.length > 0 ? new Date(Math.min(...this.syncQueue.map((a) => a.timestamp))) : null,
    }
  }

  clearQueue() {
    this.syncQueue = []
    this.saveQueueToStorage()
  }

  clearInvalidData() {
    this.cleanupInvalidUUIDs()
    console.log(`[v0] Manually cleared invalid data from offline queue`)
  }

  getDetailedQueueStatus() {
    const priorityCounts = this.syncQueue.reduce(
      (acc, action) => {
        const priority = action.priority || "medium"
        acc[priority] = (acc[priority] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return {
      ...this.getQueueStatus(),
      priorityCounts,
      retryingActions: this.syncQueue.filter((a) => (a.retryCount || 0) > 0).length,
    }
  }
}

export default OfflineSyncManager
