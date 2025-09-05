"use client"

import { useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import OfflineSyncManager from "@/lib/offline-sync"
import OfflineStorageManager from "@/lib/offline-storage"

interface UseOfflineSyncOptions {
  userId: string
  userRole: "victim" | "volunteer" | "admin"
}

export function useOfflineSync({ userId, userRole }: UseOfflineSyncOptions) {
  const syncManager = OfflineSyncManager.getInstance()
  const storageManager = OfflineStorageManager.getInstance()

  // Enhanced database operations with offline support
  const offlineAwareInsert = useCallback(
    async (table: string, data: any, priority: "high" | "medium" | "low" = "medium") => {
      const supabase = createClient()

      try {
        const result = await supabase.from(table).insert(data)

        if (result.error) {
          throw result.error
        }

        return result
      } catch (error) {
        console.log("[v0] Insert failed, adding to offline queue:", error)
        // Add to offline queue with generated ID
        const dataWithId = { ...data, id: data.id || crypto.randomUUID() }
        syncManager.addToQueue(table, "insert", dataWithId, userId, priority)

        // Return success-like response for UI
        return { data: [dataWithId], error: null }
      }
    },
    [syncManager, userId],
  )

  const offlineAwareUpdate = useCallback(
    async (table: string, data: any, id: string, priority: "high" | "medium" | "low" = "medium") => {
      const supabase = createClient()

      try {
        const result = await supabase.from(table).update(data).eq("id", id)

        if (result.error) {
          throw result.error
        }

        return result
      } catch (error) {
        console.log("[v0] Update failed, adding to offline queue:", error)
        syncManager.addToQueue(table, "update", { ...data, id }, userId, priority)

        return { data: [{ ...data, id }], error: null }
      }
    },
    [syncManager, userId],
  )

  const offlineAwareSelect = useCallback(
    async (table: string, query?: string) => {
      const supabase = createClient()

      try {
        let selectQuery = supabase.from(table).select(query || "*")

        // Add user-specific filters based on role
        if (table === "requests" && userRole === "victim") {
          selectQuery = selectQuery.eq("anonymous_victim_id", userId)
        } else if (table === "requests" && userRole === "volunteer") {
          selectQuery = selectQuery.eq("assigned_volunteer_id", userId)
        }

        const result = await selectQuery

        if (result.error) {
          throw result.error
        }

        // Cache successful results
        if (table === "requests") {
          storageManager.cacheUserRequests(userId, result.data || [])
        } else if (table === "messages") {
          storageManager.cacheUserMessages(userId, result.data || [])
        }

        return result
      } catch (error) {
        console.log("[v0] Select failed, using cached data:", error)

        // Return cached data as fallback
        let cachedData = null
        if (table === "requests") {
          cachedData = storageManager.getCachedUserRequests(userId)
        } else if (table === "messages") {
          cachedData = storageManager.getCachedUserMessages(userId)
        } else if (table === "users" && userRole === "admin") {
          cachedData = storageManager.getCachedVolunteers()
        }

        return { data: cachedData || [], error: null }
      }
    },
    [storageManager, userId, userRole],
  )

  // Initialize sync on mount
  useEffect(() => {
    // Try to sync any pending data
    syncManager.syncOfflineData()
  }, [syncManager])

  const searchOfflineData = useCallback(
    (searchTerm: string) => {
      return storageManager.searchCachedRequests(userId, searchTerm)
    },
    [storageManager, userId],
  )

  const getCacheStats = useCallback(() => {
    return storageManager.getCacheStats()
  }, [storageManager])

  const getDetailedSyncStatus = useCallback(() => {
    return syncManager.getDetailedQueueStatus()
  }, [syncManager])

  return {
    offlineAwareInsert,
    offlineAwareUpdate,
    offlineAwareSelect,
    searchOfflineData,
    getCacheStats,
    getDetailedSyncStatus,
    syncManager,
    storageManager,
  }
}
