"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import OfflineIndicator from "@/components/offline-indicator"
import OfflineStorageEnhanced from "@/components/offline-storage-enhanced"
import { useOfflineSync } from "@/hooks/use-offline-sync"
import { createClient } from "@/lib/supabase/client"

export default function AdminDashboard() {
  const [isAssigning, setIsAssigning] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [requests, setRequests] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const router = useRouter()

  const [anonymousUserId] = useState(() => {
    if (typeof window !== "undefined" && window.crypto) {
      let userId = localStorage.getItem("anonymous_admin_id")
      if (!userId) {
        userId = window.crypto.randomUUID()
        localStorage.setItem("anonymous_admin_id", userId)
      }
      return userId
    }
    // Use window.crypto only if window is defined, otherwise fallback to a random string
    return Math.random().toString(36).substring(2)
  })

  const { offlineAwareUpdate } = useOfflineSync({
    userId: anonymousUserId,
    userRole: "admin",
  })

  const loadRequestsFromDatabase = async () => {
    try {
      const supabase = createClient()

      const { data: requests, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading requests:", error)
        return
      }

      const requestsWithVolunteerInfo = await Promise.all(
        (requests || []).map(async (request) => {
          let volunteerInfo = null

          if (request.assigned_volunteer_id) {
            try {
              const { data: volunteer } = await supabase
                .from("volunteers")
                .select("*")
                .eq("anonymous_volunteer_id", request.assigned_volunteer_id)
                .maybeSingle() // Use maybeSingle instead of single to handle missing records gracefully

              volunteerInfo = volunteer
            } catch (error) {
              console.log("[v0] Could not find volunteer info for:", request.assigned_volunteer_id)
            }
          }

          return {
            ...request,
            assigned_volunteer: volunteerInfo,
            victim_display_name: request.contact_name || "Unknown",
            victim_display_phone: request.contact_phone || "No phone",
            victim_display_location: request.location || "Unknown location",
          }
        }),
      )

      setRequests(requestsWithVolunteerInfo)
    } catch (error) {
      console.error("Error loading requests from database:", error)
    }
  }

  const loadVolunteersFromDatabase = async () => {
    try {
      const supabase = createClient()

      const { data: volunteers, error } = await supabase
        .from("volunteers")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading volunteers:", error)
        return
      }

      setVolunteers(volunteers || [])
    } catch (error) {
      console.error("Error loading volunteers from database:", error)
    }
  }

  useEffect(() => {
    loadRequestsFromDatabase()
    loadVolunteersFromDatabase()
  }, [])

  useEffect(() => {
    const handleBackgroundSync = () => {
      console.log("[v0] Background sync triggered, refreshing data...")
      loadRequestsFromDatabase()
      loadVolunteersFromDatabase()
    }

    window.addEventListener("background-sync", handleBackgroundSync)
    return () => window.removeEventListener("background-sync", handleBackgroundSync)
  }, [])

  const handleAssignVolunteer = async (requestId: string, volunteerId: string) => {
    setIsAssigning(requestId);

    try {
      const volunteer = volunteers.find((v) => v.anonymous_volunteer_id === volunteerId);
      if (!volunteer) {
        throw new Error("Volunteer not found");
      }

      const updatedRequest = {
        ...requests.find((r) => r.id === requestId),
        assigned_volunteer_id: volunteerId,
        status: "assigned",
        assigned_at: new Date().toISOString(),
        assignment_method: "admin_assigned",
      };

      await offlineAwareUpdate(
        "requests",
        {
          assigned_volunteer_id: volunteerId,
          status: "assigned",
          assigned_at: new Date().toISOString(),
          assignment_method: "admin_assigned",
        },
        requestId
      );
      await offlineAwareUpdate(
        "volunteers",
        { is_available: false },
        volunteerId,
        "medium"
      );

      // Update local storage for volunteer
      const volunteerAssignedKey = `volunteer_assigned_${volunteerId}`;
      const existingAssignments = JSON.parse(localStorage.getItem(volunteerAssignedKey) || "[]");
      const updatedAssignments = [...existingAssignments.filter((r: any) => r.id !== requestId), updatedRequest];
      localStorage.setItem(volunteerAssignedKey, JSON.stringify(updatedAssignments));

      // Update victim requests in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("victim_requests_")) {
          const requestsArr = JSON.parse(localStorage.getItem(key) || "[]");
          const updatedRequests = requestsArr.map((r: any) => (r.id === requestId ? updatedRequest : r));
          localStorage.setItem(key, JSON.stringify(updatedRequests));
        }
      }

      // Send notification to volunteer
      const volunteerMessagesKey = `volunteer_messages_${volunteerId}`;
      const existingMessages = JSON.parse(localStorage.getItem(volunteerMessagesKey) || "[]");
      const assignmentMessage = {
        id: typeof window !== "undefined" && window.crypto ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
        title: `New Assignment: ${updatedRequest.title}`,
        content: `You have been assigned to help ${updatedRequest.contact_name || "a victim"} at ${updatedRequest.location}. Please check your assignments tab for details.`,
        created_at: new Date().toISOString(),
        is_read: false,
        request: updatedRequest,
      };
      localStorage.setItem(volunteerMessagesKey, JSON.stringify([assignmentMessage, ...existingMessages]));

      // Refresh local state
      setRequests((prev) => prev.map((r) => (r.id === requestId ? updatedRequest : r)));
      await loadVolunteersFromDatabase(); // Refresh volunteer list
      router.refresh();
    } catch (error) {
      console.error("Error assigning volunteer:", error);
    } finally {
      setIsAssigning(null);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const request = requests.find((r) => r.id === requestId);
      const updatedRequest = { ...request, ...updateData };

      await offlineAwareUpdate("requests", updateData, requestId);

      if (request?.assigned_volunteer_id) {
        const volunteerAssignedKey = `volunteer_assigned_${request.assigned_volunteer_id}`;
        const existingAssignments = JSON.parse(localStorage.getItem(volunteerAssignedKey) || "[]");
        const updatedAssignments = existingAssignments.map((r: any) => (r.id === requestId ? updatedRequest : r));
        localStorage.setItem(volunteerAssignedKey, JSON.stringify(updatedAssignments));

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("victim_requests_")) {
            const requestsArr = JSON.parse(localStorage.getItem(key) || "[]");
            const updatedRequests = requestsArr.map((r: any) => (r.id === requestId ? updatedRequest : r));
            localStorage.setItem(key, JSON.stringify(updatedRequests));
          }
        }

        await offlineAwareUpdate(
          "volunteers",
          { is_available: true },
          request.assigned_volunteer_id,
          "medium"
        );
      }

      // Refresh local state
      setRequests((prev) => prev.map((r) => (r.id === requestId ? updatedRequest : r)));
      router.refresh();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "assigned":
        return "bg-blue-100 text-blue-800"
      case "in_progress":
        return "bg-purple-100 text-purple-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800"
      case "high":
        return "bg-orange-100 text-orange-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Filter requests
  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.location.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || request.status === statusFilter
    const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  const pendingRequests = requests.filter((r) => r.status === "pending")
  const activeRequests = requests.filter((r) => ["assigned", "in_progress"].includes(r.status))
  const completedRequests = requests.filter((r) => r.status === "completed")
  const availableVolunteers = volunteers.filter((v) => v.is_available)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">👨‍💼 Admin Dashboard</h1>
            <p className="text-gray-600">Emergency Coordination Control Center</p>
          </div>
          <div className="flex gap-2">
            <OfflineIndicator />
            <OfflineStorageEnhanced userId={anonymousUserId} userRole="admin" />
            <Badge variant="outline" className="bg-green-100 text-green-800">
              ✅ System Online
            </Badge>
            <Button variant="outline" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-700">Pending Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-800">{pendingRequests.length}</div>
              <p className="text-xs text-yellow-600">Awaiting assignment</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Active Missions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800">{activeRequests.length}</div>
              <p className="text-xs text-blue-600">In progress</p>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-800">{completedRequests.length}</div>
              <p className="text-xs text-green-600">Successfully helped</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Available Volunteers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-800">{availableVolunteers.length}</div>
              <p className="text-xs text-purple-600">Ready to help</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="requests">🚨 Emergency Requests</TabsTrigger>
            <TabsTrigger value="volunteers">🤝 Volunteers</TabsTrigger>
            <TabsTrigger value="messages">📨 Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filter Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input
                    placeholder="Search requests, victims, or locations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Requests List */}
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No requests match your filters</p>
                  </CardContent>
                </Card>
              ) : (
                filteredRequests.map((request) => (
                  <Card key={request.id} className="border-l-4 border-l-red-400">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{request.title}</CardTitle>
                          <CardDescription>
                            👤 {request.contact_name} | 📍 {request.location} | 👥 {request.people_count} people
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getPriorityColor(request.priority)}>{request.priority}</Badge>
                          <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                          {request.assigned_volunteer_id && (
                            <Badge
                              variant="outline"
                              className={
                                request.assignment_method === "self_accepted"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-blue-100 text-blue-800"
                              }
                            >
                              {request.assignment_method === "self_accepted"
                                ? "🤝 Self-Accepted"
                                : "👨‍💼 Admin Assigned"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600">{request.description}</p>

                      <div className="text-xs text-gray-500 space-y-1">
                        <p>📅 Created: {new Date(request.created_at).toLocaleString()}</p>
                        <p>📞 Contact: {request.contact_phone}</p>
                        {request.assigned_volunteer_id && (
                          <div className="text-blue-600 space-y-1">
                            <p>🤝 Assigned to: {request.assigned_volunteer?.full_name || "Unknown Volunteer"}</p>
                            {request.assigned_volunteer?.phone && (
                              <p>📞 Volunteer Phone: {request.assigned_volunteer.phone}</p>
                            )}
                            {request.assignment_method === "self_accepted" && request.accepted_at && (
                              <p>✅ Self-accepted: {new Date(request.accepted_at).toLocaleString()}</p>
                            )}
                            {request.assigned_at && (
                              <p>📋 Assigned: {new Date(request.assigned_at).toLocaleString()}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {request.status === "pending" && (
                          <div className="flex gap-2">
                            <Select
                              onValueChange={(volunteerId) => handleAssignVolunteer(request.id, volunteerId)}
                              disabled={isAssigning === request.id}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Assign volunteer..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVolunteers.map((volunteer) => (
                                  <SelectItem
                                    key={volunteer.anonymous_volunteer_id}
                                    value={volunteer.anonymous_volunteer_id}
                                  >
                                    {volunteer.full_name} ({volunteer.location || "No location"})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {request.status !== "completed" && request.status !== "cancelled" && (
                          <Select
                            value={request.status}
                            onValueChange={(status) => handleUpdateStatus(request.id, status)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="assigned">Assigned</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="volunteers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>🤝 Volunteer Management</CardTitle>
                <CardDescription>Manage volunteer assignments and availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {volunteers.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No volunteers registered</p>
                  ) : (
                    volunteers.map((volunteer) => (
                      <div
                        key={volunteer.anonymous_volunteer_id}
                        className="flex justify-between items-center p-4 border rounded-lg"
                      >
                        <div>
                          <h3 className="font-semibold">{volunteer.full_name}</h3>
                          <p className="text-sm text-gray-600">📞 {volunteer.phone || "No phone"}</p>
                          <p className="text-sm text-gray-600">📍 {volunteer.location || "No location"}</p>
                          <p className="text-xs text-gray-500">
                            Registered: {new Date(volunteer.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              volunteer.is_available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }
                          >
                            {volunteer.is_available ? "Available" : "Busy"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>📨 System Messages</CardTitle>
                <CardDescription>Recent notifications and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No messages</p>
                  ) : (
                    messages.map((message) => (
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
