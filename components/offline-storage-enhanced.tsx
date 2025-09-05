"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import OfflineStorageManager from "@/lib/offline-storage"
import OfflineSyncManager from "@/lib/offline-sync"

interface OfflineStorageEnhancedProps {
  userId: string
  userRole: "victim" | "volunteer" | "admin"
}

export default function OfflineStorageEnhanced({ userId, userRole }: OfflineStorageEnhancedProps) {
  const [storageInfo, setStorageInfo] = useState({
    cachedRequests: 0,
    cachedMessages: 0,
    pendingSync: 0,
    lastSync: null as Date | null,
    storageUsed: 0,
  })
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    updateStorageInfo()

    // Update storage info periodically
    const interval = setInterval(updateStorageInfo, 10000)
    return () => clearInterval(interval)
  }, [userId])

  const updateStorageInfo = () => {
    const storageManager = OfflineStorageManager.getInstance()
    const syncManager = OfflineSyncManager.getInstance()

    const cachedRequests = storageManager.getCachedUserRequests(userId)?.length || 0
    const cachedMessages = storageManager.getCachedUserMessages(userId)?.length || 0
    const syncStatus = syncManager.getQueueStatus()

    // Calculate approximate storage usage
    let storageUsed = 0
    try {
      const keys = Object.keys(localStorage).filter((key) => key.includes("flood_coordination") || key.includes(userId))
      keys.forEach((key) => {
        const value = localStorage.getItem(key)
        if (value) {
          storageUsed += new Blob([value]).size
        }
      })
    } catch (error) {
      console.error("Error calculating storage usage:", error)
    }

    setStorageInfo({
      cachedRequests,
      cachedMessages,
      pendingSync: syncStatus.queueLength,
      lastSync: syncStatus.oldestAction,
      storageUsed: Math.round(storageUsed / 1024), // Convert to KB
    })
  }

  const handleClearCache = () => {
    const storageManager = OfflineStorageManager.getInstance()
    storageManager.clear()
    updateStorageInfo()
  }

  const handleForcSync = async () => {
    const syncManager = OfflineSyncManager.getInstance()
    await syncManager.syncOfflineData()
    updateStorageInfo()
  }

  if (!showDetails) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowDetails(true)} className="text-xs">
        📱 Storage ({storageInfo.storageUsed}KB)
      </Button>
    )
  }

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          📱 Offline Storage
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(false)}>
            ✕
          </Button>
        </CardTitle>
        <CardDescription>Local data cache and sync status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <p>
              <strong>Cached Requests:</strong> {storageInfo.cachedRequests}
            </p>
            <p>
              <strong>Cached Messages:</strong> {storageInfo.cachedMessages}
            </p>
          </div>
          <div className="space-y-1">
            <p>
              <strong>Pending Sync:</strong> {storageInfo.pendingSync}
            </p>
            <p>
              <strong>Storage Used:</strong> {storageInfo.storageUsed}KB
            </p>
          </div>
        </div>

        {storageInfo.pendingSync > 0 && (
          <div className="space-y-2">
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              {storageInfo.pendingSync} actions pending sync
            </Badge>
            <Button size="sm" variant="outline" onClick={handleForcSync} className="w-full bg-transparent">
              🔄 Force Sync Now
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <Button size="sm" variant="outline" onClick={updateStorageInfo} className="w-full bg-transparent">
            🔄 Refresh Info
          </Button>
          <Button size="sm" variant="destructive" onClick={handleClearCache} className="w-full">
            🗑️ Clear Cache
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>💡 Data is automatically cached for offline use</p>
          <p>🔄 Sync happens automatically when online</p>
          <p>📱 Works completely offline</p>
        </div>
      </CardContent>
    </Card>
  )
}
