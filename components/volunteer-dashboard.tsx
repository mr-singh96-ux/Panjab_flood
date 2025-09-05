"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"
import OfflineIndicator from "@/components/offline-indicator"
import OfflineStorageEnhanced from "@/components/offline-storage-enhanced"
import { useOfflineSync } from "@/hooks/use-offline-sync"

// const handleUpdateStatus = async (requestId: string, newStatus: string) => {
//   // Placeholder – implement later
// }

export default function VolunteerDashboard() {
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [assignedRequests, setAssignedRequests] = useState<any[]>([])
  const [availableRequests, setAvailableRequests] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [isAvailable, setIsAvailable] = useState(true)
  const [volunteerInfo, setVolunteerInfo] = useState({
    name: "",
    phone: "",
    location: "",
  })
  const [showRegistration, setShowRegistration] = useState(false)
  const [isAccepting, setIsAccepting] = useState<string | null>(null)
  const [isLoadingVolunteer, setIsLoadingVolunteer] = useState(true)
  // Notes for each request
const [updateNotes, setUpdateNotes] = useState<Record<string, string>>({})
const handleUpdateStatus = async (requestId: string, newStatus: string) => {
  if (!volunteerInfo || !anonymousUserId) return;

  setIsUpdating(requestId);

  try {
    const supabase = createClient();

    // 1. Update the request status
    const { error: requestError } = await supabase
      .from("requests") // Ensure this matches your actual table name
      .update({ status: newStatus })
      .eq("id", requestId);

    if (requestError) throw requestError;

    // 2. If marking completed → set volunteer available again
    if (newStatus === "completed") {
      const { error: volError } = await supabase
        .from("volunteers")
        .update({ is_available: true })
        .eq("anonymous_volunteer_id", anonymousUserId);

      if (volError) throw volError;

      setIsAvailable(true);
      if (typeof window !== "undefined") {
        localStorage.setItem(`volunteer_available_${anonymousUserId}`, "true");
      }
    }

    // 3. Refresh requests
    await loadRequestsFromDatabase();
  } catch (err) {
    console.error("Error updating status:", err);
  } finally {
    setIsUpdating(null);
  }
};
// Derived lists from assignedRequests
const activeAssignments = assignedRequests.filter(
  (r) => r.status === "assigned" || r.status === "in_progress"
)
const completedAssignments = assignedRequests.filter((r) => r.status === "completed")

// Helpers for badge colors/icons
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800"
    case "medium":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-green-100 text-green-800"
  }
}

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case "high":
      return "🔥"
    case "medium":
      return "⚠️"
    default:
      return "🟢"
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "assigned":
      return "bg-blue-100 text-blue-800"
    case "in_progress":
      return "bg-purple-100 text-purple-800"
    case "completed":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

  const router = useRouter()

  // ✅ Initialize safely with null, then fill in client-side
  const [anonymousUserId, setAnonymousUserId] = useState<string | null>(null)

  const { offlineAwareInsert } = useOfflineSync({
    userId: anonymousUserId ?? "",
    userRole: "volunteer",
  })

  // ✅ Generate or restore volunteer ID on client
  useEffect(() => {
    if (typeof window === "undefined") return
    const storedId = typeof localStorage !== "undefined" ? localStorage.getItem("anonymous_volunteer_id") : null
    const newId = storedId || (typeof crypto !== "undefined" ? crypto.randomUUID() : "")
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("anonymous_volunteer_id", newId)
    }
    setAnonymousUserId(newId)
  }, [])

  // 🔎 Identify volunteer by phone
  const identifyVolunteerByPhone = async (phone: string) => {
    try {
      const supabase = createClient()
      const { data: volunteers, error } = await supabase
        .from("volunteers")
        .select("anonymous_volunteer_id, full_name, phone, location, is_available")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)

      if (error) throw error
      return volunteers?.[0] || null
    } catch (error) {
      console.error("Error in identifyVolunteerByPhone:", error)
      return null
    }
  }

  // Restore volunteer session
  const restoreVolunteerSession = async (volunteer: any) => {
    if (!volunteer) return
    console.log("[v0] Restoring volunteer session for:", volunteer.full_name)

    if (anonymousUserId === volunteer.anonymous_volunteer_id) return

    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem("anonymous_volunteer_id", volunteer.anonymous_volunteer_id)
      localStorage.setItem(
        `volunteer_info_${volunteer.anonymous_volunteer_id}`,
        JSON.stringify({
          name: volunteer.full_name,
          phone: volunteer.phone,
          location: volunteer.location,
        }),
      )
    }

    setAnonymousUserId(volunteer.anonymous_volunteer_id)
    setVolunteerInfo({
      name: volunteer.full_name,
      phone: volunteer.phone,
      location: volunteer.location,
    })
    setIsAvailable(volunteer.is_available ?? true)
    setShowRegistration(false)
    await loadRequestsFromDatabase()
  }

const initializeVolunteer = async () => {
  setIsLoadingVolunteer(true)
  try {
    const savedInfo = typeof localStorage !== "undefined" ? localStorage.getItem(`volunteer_info_${anonymousUserId}`) : null
    const savedAvail = typeof localStorage !== "undefined" ? localStorage.getItem(`volunteer_available_${anonymousUserId}`) : null
    if (savedInfo) {
      const info = JSON.parse(savedInfo)
      const existingVolunteer = await identifyVolunteerByPhone(info.phone)

      if (existingVolunteer) {
        if (existingVolunteer.anonymous_volunteer_id !== anonymousUserId) {
          await restoreVolunteerSession(existingVolunteer)
        } else {
          setVolunteerInfo(info)
          setIsAvailable(
            savedAvail ? JSON.parse(savedAvail) : (existingVolunteer.is_available ?? true)
          )
          setShowRegistration(false)
          await loadRequestsFromDatabase()
        }
      } else {
        setVolunteerInfo(info)
        setShowRegistration(true)
      }
    } else {
      setShowRegistration(true)
    }
  } catch (error) {
    console.error("Error initializing volunteer:", error)
    setShowRegistration(true)
  } finally {
    setIsLoadingVolunteer(false)
  }
}

  const loadRequestsFromDatabase = async () => {
    if (!anonymousUserId) return
    try {
      const supabase = createClient()

      // Assigned requests
      const { data: assigned, error: assignedError } = await supabase
        .from("requests")
        .select("*")
        .eq("assigned_volunteer_id", anonymousUserId)
        .order("created_at", { ascending: false })
      if (!assignedError) {
        setAssignedRequests(
          (assigned || []).map(r => ({
            ...r,
            victim_display_name: r.contact_name || "Unknown",
            victim_display_phone: r.contact_phone || "No phone",
            victim_display_location: r.location || "Unknown location",
          })),
        )
      }

      // Available requests
      const { data: available, error: availableError } = await supabase
        .from("requests")
        .select("*")
        .eq("status", "pending")
        .is("assigned_volunteer_id", null)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
      if (!availableError) {
        setAvailableRequests(
          (available || []).map(r => ({
            ...r,
            victim_display_name: r.contact_name || "Unknown",
            victim_display_phone: r.contact_phone || "No phone",
            victim_display_location: r.location || "Unknown location",
          })),
        )
      }
    } catch (error) {
      console.error("Error loading requests:", error)
    }
  }

  // ✅ Initial load
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!anonymousUserId) return
    initializeVolunteer()
    if (typeof localStorage !== "undefined") {
      const savedMessages = localStorage.getItem(`volunteer_messages_${anonymousUserId}`)
      if (savedMessages) setMessages(JSON.parse(savedMessages))
    }
  }, [anonymousUserId])

  // ✅ Reload requests after state changes
  useEffect(() => {
    if (!showRegistration && !isLoadingVolunteer && anonymousUserId) {
      loadRequestsFromDatabase()
    }
  }, [anonymousUserId, showRegistration, isLoadingVolunteer])

  // ✅ Background sync
  useEffect(() => {
    if (typeof window === "undefined") return
    const handleBackgroundSync = () => loadRequestsFromDatabase()
    window.addEventListener("background-sync", handleBackgroundSync)
    return () => window.removeEventListener("background-sync", handleBackgroundSync)
  }, [])

  // 🔑 Register volunteer
  const handleRegisterVolunteer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const supabase = createClient()
      const existingVolunteer = await identifyVolunteerByPhone(volunteerInfo.phone)

      if (existingVolunteer) {
        await restoreVolunteerSession(existingVolunteer)
        return
      }

      const volunteerIdToUse = anonymousUserId
      if (!volunteerIdToUse) return

      const { error: insertError } = await supabase.from("volunteers").insert({
        anonymous_volunteer_id: volunteerIdToUse,
        full_name: volunteerInfo.name,
        phone: volunteerInfo.phone,
        location: volunteerInfo.location,
        is_available: true,
      })

      if (insertError) {
        console.error("Insert error:", insertError)
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("anonymous_volunteer_id", volunteerIdToUse)
        localStorage.setItem(`volunteer_info_${volunteerIdToUse}`, JSON.stringify(volunteerInfo))
      }

      setShowRegistration(false)
      await loadRequestsFromDatabase()
    } catch (error) {
      console.error("Error registering volunteer:", error)
    }
  }

  // 🔑 Toggle availability
 const handleToggleAvailability = async (checked: boolean) => {
  if (!anonymousUserId) return;

  setIsAvailable(checked); // update UI immediately
  if (typeof window !== "undefined") {
    localStorage.setItem(`volunteer_available_${anonymousUserId}`, JSON.stringify(checked));
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("volunteers") // ✅ correct table
    .update({ is_available: checked })
    .eq("anonymous_volunteer_id", anonymousUserId);

  if (error) {
    console.error("Failed to update availability:", error);
    // rollback if failed
    setIsAvailable(!checked);
    if (typeof window !== "undefined") {
      localStorage.setItem(`volunteer_available_${anonymousUserId}`, JSON.stringify(!checked));
    }
  }
};

  // 🔑 Logout handler
  const handleLogout = () => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.removeItem("anonymous_volunteer_id")
      localStorage.removeItem(`volunteer_info_${anonymousUserId}`)
      localStorage.removeItem(`volunteer_messages_${anonymousUserId}`)
      localStorage.removeItem(`volunteer_assigned_${anonymousUserId}`)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && (key.startsWith("volunteer_") || key.includes(anonymousUserId!))) {
          localStorage.removeItem(key)
        }
      }
    }
    router.push("/")
  }

  // Accept request handler
  const handleAcceptRequest = async (requestId: string) => {
    if (!anonymousUserId) return
    setIsAccepting(requestId)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("accept_request_by_volunteer", {
        request_id_param: requestId,
        volunteer_id_param: anonymousUserId,
      })
      if (error || !data) throw new Error("Failed to accept request")

      await loadRequestsFromDatabase()
      await handleToggleAvailability(false)

      const request = availableRequests.find((r: any) => r.id === requestId)
      if (request) {
        await offlineAwareInsert("messages", {
          anonymous_sender_id: anonymousUserId,
          recipient_id: null,
          request_id: requestId,
          message_type: "assignment",
          title: `Volunteer Self-Assigned: ${request.title}`,
          content: `${volunteerInfo.name} has accepted the request "${request.title}" at ${request.location}. Contact: ${volunteerInfo.phone}`,
        })
      }

      router.refresh()
    } catch (error) {
      console.error("Error accepting request:", error)
      alert(error instanceof Error ? error.message : "Failed to accept request.")
    } finally {
      setIsAccepting(null)
    }
  }

  // … (UI code remains the same as yours: registration form, dashboard tabs, request cards, etc.)

  // ⬆️ keep your UI JSX as-is since it’s already well structured.


  if (isLoadingVolunteer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading volunteer data...</p>
        </div>
      </div>
    )
  }

  if (showRegistration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-blue-600">🤝 Volunteer Registration</h1>
            <p className="text-gray-600">Quick registration to help flood victims</p>
            <p className="text-sm text-blue-600 mt-2">
              💡 If you've volunteered before, enter your phone number to restore your data
            </p>
          </div>

          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-700">Your Information</CardTitle>
              <CardDescription>We need basic info to coordinate rescue efforts</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegisterVolunteer} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    required
                    value={volunteerInfo.name}
                    onChange={(e) => setVolunteerInfo({ ...volunteerInfo, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    required
                    value={volunteerInfo.phone}
                    onChange={(e) => setVolunteerInfo({ ...volunteerInfo, phone: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">This will be used to identify you if you return later</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Your Location *</Label>
                  <Input
                    id="location"
                    placeholder="Your current area/neighborhood"
                    required
                    value={volunteerInfo.location}
                    onChange={(e) => setVolunteerInfo({ ...volunteerInfo, location: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                  🤝 Start Volunteering
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-blue-600">🤝 Volunteer Dashboard</h1>
            <p className="text-gray-600">Welcome, {volunteerInfo.name}</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="availability">Available for assignments</Label>
              <Switch
                id="availability"
                checked={isAvailable}
                onCheckedChange={handleToggleAvailability}
              />
            </div>
            <Badge
              variant="outline"
              className={isAvailable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
            >
              {isAvailable ? "✅ Available" : "🔴 Busy"}
            </Badge>
            <OfflineIndicator />
            <OfflineStorageEnhanced userId={anonymousUserId ?? ""} userRole="volunteer" />
            <Button
              variant="outline"
              onClick={handleLogout}
              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
            >
              🚪 Logout
            </Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Active Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800">{activeAssignments.length}</div>
              <p className="text-xs text-blue-600">Current missions</p>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Completed Missions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-800">{completedAssignments.length}</div>
              <p className="text-xs text-green-600">People helped</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Available Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-800">{availableRequests.length}</div>
              <p className="text-xs text-orange-600">Awaiting volunteers</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="assignments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="assignments">🎯 My Assignments</TabsTrigger>
            <TabsTrigger value="available">📋 Available Requests</TabsTrigger>
            <TabsTrigger value="completed">✅ Completed</TabsTrigger>
            <TabsTrigger value="messages">📨 Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🎯 Active Assignments</CardTitle>
                <CardDescription>Your current emergency response missions</CardDescription>
              </CardHeader>
              <CardContent>
                {activeAssignments.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No active assignments</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Check the Available Requests tab to see what needs help
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeAssignments.map((request) => (
                      <Card key={request.id} className="border-l-4 border-l-blue-400">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{request.title}</CardTitle>
                              <CardDescription>
                                👤 {request.contact_name} | 📍 {request.location} | 👥 {request.people_count} people
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Badge className={getPriorityColor(request.priority)}>
                                {getPriorityIcon(request.priority)} {request.priority}
                              </Badge>
                              <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-gray-600">{request.description}</p>

                          <div className="text-xs text-gray-500 space-y-1">
                            <p>📅 Assigned: {new Date(request.assigned_at || request.created_at).toLocaleString()}</p>
                            <p>📞 Contact: {request.contact_phone}</p>
                            <p>🏠 Victim Location: {request.location}</p>
                          </div>

                          <div className="space-y-3">
                            <div className="grid gap-2">
                              <Label htmlFor={`notes-${request.id}`}>Update Notes (optional)</Label>
                              <Input
                                id={`notes-${request.id}`}
                                placeholder="Add any notes about your progress..."
                                value={updateNotes[request.id] || ""}
                                onChange={(e) => setUpdateNotes({ ...updateNotes, [request.id]: e.target.value })}
                                className="h-10"
                              />
                            </div>

                            <div className="flex gap-2 flex-wrap">
                              {request.status === "assigned" && (
                                <Button
                                  onClick={() => handleUpdateStatus(request.id, "in_progress")}
                                  disabled={isUpdating === request.id}
                                  className="bg-purple-600 hover:bg-purple-700"
                                >
                                  🚀 Start Mission
                                </Button>
                              )}

                              {request.status === "in_progress" && (
                                <Button
                                  onClick={() => handleUpdateStatus(request.id, "completed")}
                                  disabled={isUpdating === request.id}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  ✅ Mark Complete
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                onClick={() => {
                                  if (typeof window !== "undefined") {
                                    const phone = request.contact_phone
                                    if (phone && phone !== "No phone") {
                                      window.open(`tel:${phone}`, "_self")
                                    }
                                  }
                                }}
                                disabled={!request.contact_phone || request.contact_phone === "No phone"}
                              >
                                📞 Call Victim
                              </Button>

                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📋 Available Emergency Requests</CardTitle>
                <CardDescription>
                  Requests awaiting volunteer assignment (sorted by priority)
                  {!isAvailable && (
                    <span className="block text-orange-600 mt-1">
                      ⚠️ You're marked as unavailable. Toggle availability above to receive assignments.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending requests at the moment</p>
                ) : (
                  <div className="space-y-4">
                    {availableRequests.map((request) => (
                      <Card key={request.id} className="border-l-4 border-l-yellow-400">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{request.title}</CardTitle>
                              <CardDescription>
                                👤 {request.contact_name} | 📍 {request.location} | 👥 {request.people_count} people
                              </CardDescription>
                            </div>
                            <Badge className={getPriorityColor(request.priority)}>
                              {getPriorityIcon(request.priority)} {request.priority}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-sm text-gray-600">{request.description}</p>
                          <div className="text-xs text-gray-500">
                            <p>📅 Requested: {new Date(request.created_at).toLocaleString()}</p>
                            <p>📞 Contact: {request.contact_phone}</p>
                          </div>
                          {isAvailable && (
                            <div className="pt-2">
                              <Button
                                onClick={() => handleAcceptRequest(request.id)}
                                disabled={isAccepting === request.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {isAccepting === request.id ? "Accepting..." : "🤝 Accept This Request"}
                              </Button>
                            </div>
                          )}
                          {!isAvailable && (
                            <p className="text-xs text-orange-600 mt-2">
                              💡 Set yourself as available above to accept requests
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>✅ Completed Missions</CardTitle>
                <CardDescription>Your successful emergency response history</CardDescription>
              </CardHeader>
              <CardContent>
                {completedAssignments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No completed missions yet</p>
                ) : (
                  <div className="space-y-4">
                    {completedAssignments.map((request) => (
                      <Card key={request.id} className="border-l-4 border-l-green-400">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{request.title}</CardTitle>
                              <CardDescription>
                                👤 {request.contact_name} | 📍 {request.location}
                              </CardDescription>
                            </div>
                            <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p>📅 Completed: {new Date(request.completed_at || request.updated_at).toLocaleString()}</p>
                            <p>
                              ⏱️ Duration:{" "}
                              {request.assigned_at && request.completed_at
                                ? Math.round(
                                    (new Date(request.completed_at).getTime() -
                                      new Date(request.assigned_at).getTime()) /
                                      (1000 * 60 * 60),
                                  ) + " hours"
                                : "N/A"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📨 Messages & Updates</CardTitle>
                <CardDescription>Assignment notifications and system updates</CardDescription>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No messages</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`border rounded-lg p-3 ${!message.is_read ? "bg-blue-50 border-blue-200" : ""}`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium">{message.title}</h4>
                          <span className="text-xs text-gray-500">{new Date(message.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{message.content}</p>
                        {message.request && (
                          <p className="text-xs text-blue-600 mt-1">Related to: {message.request.title}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
