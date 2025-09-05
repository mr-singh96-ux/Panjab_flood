"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import OfflineSyncManager from "@/lib/offline-sync"

export default function OfflineIndicator() {
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    queueLength: 0,
    oldestAction: null as Date | null,
    priorityCounts: {} as Record<string, number>,
    retryingActions: 0,
  })
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const syncManager = OfflineSyncManager.getInstance()

    const updateStatus = () => {
      setSyncStatus(syncManager.getDetailedQueueStatus())
    }

    updateStatus()

    const handleOnline = () => updateStatus()
    const handleOffline = () => updateStatus()

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    const interval = setInterval(updateStatus, 5000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [])

  const handleManualSync = async () => {
    const syncManager = OfflineSyncManager.getInstance()
    await syncManager.syncOfflineData()
    setSyncStatus(syncManager.getDetailedQueueStatus())
  }

  if (syncStatus.isOnline && syncStatus.queueLength === 0) {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800">
        ✅ Online & Synced
      </Badge>
    )
  }

  return (
    <div className="relative">
      <Badge
        variant="outline"
        className={`cursor-pointer ${
          syncStatus.isOnline ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
        }`}
        onClick={() => setShowDetails(!showDetails)}
      >
        {syncStatus.isOnline ? "🔄" : "📴"}
        {syncStatus.isOnline ? "Syncing..." : "Offline Mode"}
        {syncStatus.queueLength > 0 && ` (${syncStatus.queueLength})`}
        {syncStatus.retryingActions > 0 && " ⚠️"}
      </Badge>

      {showDetails && (
        <Card className="absolute top-full right-0 mt-2 w-80 z-50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-sm">{syncStatus.isOnline ? "🔄 Sync Status" : "📴 Offline Mode"}</CardTitle>
            <CardDescription>
              {syncStatus.isOnline ? "Connected to internet" : "No internet connection - data will sync when restored"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-1">
              <p>
                <strong>Connection:</strong> {syncStatus.isOnline ? "Online" : "Offline"}
              </p>
              <p>
                <strong>Pending Actions:</strong> {syncStatus.queueLength}
              </p>
              {Object.keys(syncStatus.priorityCounts).length > 0 && (
                <div className="text-xs text-gray-600">
                  Priority:{" "}
                  {Object.entries(syncStatus.priorityCounts)
                    .map(([priority, count]) => `${priority}: ${count}`)
                    .join(", ")}
                </div>
              )}
              {syncStatus.retryingActions > 0 && (
                <p className="text-xs text-orange-600">
                  <strong>Retrying:</strong> {syncStatus.retryingActions} actions
                </p>
              )}
              {syncStatus.oldestAction && (
                <p>
                  <strong>Oldest Pending:</strong> {syncStatus.oldestAction.toLocaleString()}
                </p>
              )}
            </div>

            {syncStatus.queueLength > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">
                  {syncStatus.queueLength} actions waiting to sync.
                  {syncStatus.isOnline ? " Syncing automatically..." : " Will sync when connection is restored."}
                </p>

                {syncStatus.isOnline && (
                  <Button size="sm" variant="outline" onClick={handleManualSync} className="w-full bg-transparent">
                    🔄 Sync Now
                  </Button>
                )}
              </div>
            )}

            <Button size="sm" variant="ghost" onClick={() => setShowDetails(false)} className="w-full">
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
