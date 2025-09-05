"use client";

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import OfflineIndicator from "@/components/offline-indicator"
import OfflineStorageEnhanced from "@/components/offline-storage-enhanced"
import { useOfflineSync } from "@/hooks/use-offline-sync"
import { createClient } from "@/lib/supabase/client"

interface VictimDashboardProps {
  user?: any
  requests?: any[]
  messages?: any[]
}

export default function VictimDashboard({ user, requests = [], messages = [] }: VictimDashboardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    priority: "medium",
    location: user?.location || "",
    peopleCount: 1,
    contactName: "",
    contactPhone: "",
  })
  const router = useRouter()

  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  const [anonymousUserId, setAnonymousUserId] = useState(() => {
    if (typeof window !== "undefined") {
      let userId = localStorage.getItem("anonymous_victim_id")

      // Clear any invalid UUIDs from localStorage
      if (!userId || !isValidUUID(userId)) {
        console.log("[v0] Invalid or missing UUID, generating new one:", userId)

        // Clear all old localStorage data with invalid UUIDs
        if (userId && !isValidUUID(userId)) {
          localStorage.removeItem(`victim_requests_${userId}`)
          localStorage.removeItem(`victim_messages_${userId}`)
        }

        userId = window.crypto.randomUUID()
        localStorage.setItem("anonymous_victim_id", userId)
      }
      return userId
    }
    // Return null for server-side rendering, will be set in useEffect
    return null
  })

  useEffect(() => {
    if (typeof window !== "undefined" && !anonymousUserId) {
      const userId = window.crypto.randomUUID()
      localStorage.setItem("anonymous_victim_id", userId)
      setAnonymousUserId(userId)
    }
  }, [anonymousUserId])

  const { offlineAwareInsert } = useOfflineSync({
    userId: anonymousUserId ?? "",
    userRole: "victim",
  })

  const [localRequests, setRequests] = useState(requests || [])
  const [localMessages, setMessages] = useState(messages || [])
  const supabase = createClient()

  useEffect(() => {
    if (anonymousUserId && isValidUUID(anonymousUserId)) {
      loadRequestsFromDatabase()
      loadMessagesFromDatabase()
    }
  }, [anonymousUserId])

  const loadRequestsFromDatabase = async () => {
    if (!anonymousUserId || !isValidUUID(anonymousUserId)) {
      console.error("Invalid or missing UUID, cannot load requests:", anonymousUserId)
      return
    }

    try {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("anonymous_victim_id", anonymousUserId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading requests:", error)
        const savedRequests = localStorage.getItem(`victim_requests_${anonymousUserId}`)
        if (savedRequests) {
          setRequests(JSON.parse(savedRequests))
        }
      } else {
        const requestsWithVolunteers = await Promise.all(
          (data || []).map(async (request) => {
            if (request.assigned_volunteer_id) {
              try {
                const { data: volunteerData } = await supabase
                  .from("volunteers")
                  .select("full_name, phone")
                  .eq("anonymous_volunteer_id", request.assigned_volunteer_id)
                  .single()

                return {
                  ...request,
                  assigned_volunteer: volunteerData,
                }
              } catch (error) {
                console.log("No volunteer data found for:", request.assigned_volunteer_id)
                return request
              }
            }
            return request
          }),
        )

        setRequests(requestsWithVolunteers)
        localStorage.setItem(`victim_requests_${anonymousUserId}`, JSON.stringify(requestsWithVolunteers))
      }
    } catch (error) {
      console.error("Database connection error:", error)
      const savedRequests = localStorage.getItem(`victim_requests_${anonymousUserId}`)
      if (savedRequests) {
        setRequests(JSON.parse(savedRequests))
      }
    }
  }

  const loadMessagesFromDatabase = async () => {
    if (!anonymousUserId || !isValidUUID(anonymousUserId)) {
      console.error("Invalid or missing UUID, cannot load messages:", anonymousUserId)
      return
    }

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("anonymous_recipient_id", anonymousUserId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading messages:", error)
        const savedMessages = localStorage.getItem(`victim_messages_${anonymousUserId}`)
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages))
        }
      } else {
        setMessages(data || [])
        localStorage.setItem(`victim_messages_${anonymousUserId}`, JSON.stringify(data || []))
      }
    } catch (error) {
      console.error("Database connection error:", error)
      const savedMessages = localStorage.getItem(`victim_messages_${anonymousUserId}`)
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages))
      }
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!anonymousUserId || !isValidUUID(anonymousUserId)) {
      console.error("Invalid UUID, cannot submit request:", anonymousUserId)
      return
    }

    setIsSubmitting(true)

    try {
      const requestData = {
        anonymous_victim_id: anonymousUserId,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        location: formData.location,
        people_count: formData.peopleCount,
        contact_info: `${formData.contactName} - ${formData.contactPhone}`, // Store contact info for anonymous users
        contact_name: formData.contactName, // Always include contact_name in database insert
        contact_phone: formData.contactPhone, // Always include contact_phone in database insert
        status: "pending",
      }

      const { data, error } = await supabase.from("requests").insert(requestData).select().single()

      if (error) {
        console.error("Database insert error:", error)
        const localRequestData = {
          ...requestData,
          id: window.crypto.randomUUID(),
          created_at: new Date().toISOString(),
        }
        const newRequests = [...localRequests, localRequestData]
        setRequests(newRequests)
        localStorage.setItem(`victim_requests_${anonymousUserId}`, JSON.stringify(newRequests))
        await offlineAwareInsert("requests", localRequestData)
      } else {
        const newRequests = [...localRequests, data]
        setRequests(newRequests)
        localStorage.setItem(`victim_requests_${anonymousUserId}`, JSON.stringify(newRequests))
      }

      setFormData({
        title: "",
        description: "",
        category: "",
        priority: "medium",
        location: "",
        peopleCount: 1,
        contactName: "",
        contactPhone: "",
      })
      setShowNewRequest(false)
    } catch (error) {
      console.error("Error submitting request:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

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

  useEffect(() => {
    const handleBackgroundSync = () => {
      console.log("[v0] Background sync triggered, refreshing data...")
      loadRequestsFromDatabase()
      loadMessagesFromDatabase()
    }

    window.addEventListener("background-sync", handleBackgroundSync)
    return () => window.removeEventListener("background-sync", handleBackgroundSync)
  }, [])

  if (!anonymousUserId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing emergency system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-red-600">🆘 Emergency Help</h1>
            <p className="text-gray-600">Welcome, {user?.full_name || "Emergency User"}</p>
          </div>
          <div className="flex gap-2">
            <OfflineIndicator />
            <OfflineStorageEnhanced userId={anonymousUserId} userRole="victim" />
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Back to Home
            </Button>
          </div>
        </div>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">🚨 Need Help?</CardTitle>
            <CardDescription>Submit a new emergency request for assistance</CardDescription>
          </CardHeader>
          <CardContent>
            {!showNewRequest ? (
              <Button onClick={() => setShowNewRequest(true)} className="w-full bg-red-600 hover:bg-red-700 text-white">
                🆘 Request Emergency Help
              </Button>
            ) : (
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contactName">Your Name *</Label>
                    <Input
                      id="contactName"
                      placeholder="Your full name"
                      required
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactPhone">Phone Number *</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      required
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="title">What do you need help with?</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Need food and water for family"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Type of Help</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rescue">🚁 Rescue/Evacuation</SelectItem>
                      <SelectItem value="medical">🏥 Medical Emergency</SelectItem>
                      <SelectItem value="food">🍞 Food</SelectItem>
                      <SelectItem value="water">💧 Clean Water</SelectItem>
                      <SelectItem value="shelter">🏠 Shelter</SelectItem>
                      <SelectItem value="supplies">📦 Supplies</SelectItem>
                      <SelectItem value="other">❓ Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="priority">Urgency Level</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">🔴 Critical - Life Threatening</SelectItem>
                      <SelectItem value="high">🟠 High - Urgent</SelectItem>
                      <SelectItem value="medium">🟡 Medium - Important</SelectItem>
                      <SelectItem value="low">🟢 Low - Can Wait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Details</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your situation in detail..."
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      placeholder="Your current location/address"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="peopleCount">Number of People</Label>
                    <Input
                      id="peopleCount"
                      type="number"
                      min="1"
                      value={formData.peopleCount}
                      onChange={(e) => {
                        const value = e.target.value
                        const parsedValue = Number.parseInt(value)
                        setFormData({
                          ...formData,
                          peopleCount: isNaN(parsedValue) ? 1 : parsedValue,
                        })
                      }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700">
                    {isSubmitting ? "Submitting..." : "🚨 Submit Request"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowNewRequest(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📋 My Help Requests</CardTitle>
            <CardDescription>Track the status of your emergency requests</CardDescription>
          </CardHeader>
          <CardContent>
            {localRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No requests yet</p>
            ) : (
              <div className="space-y-4">
                {localRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold">{request.title}</h3>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(request.priority)}>{request.priority}</Badge>
                        <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{request.description}</p>
                    <div className="text-xs text-gray-500">
                      <p>👤 {request.contact_name}</p>
                      <p>📞 {request.contact_phone}</p>
                      <p>📍 {request.location}</p>
                      <p>👥 {request.people_count} people</p>
                      <p>📅 {new Date(request.created_at).toLocaleDateString()}</p>
                      {request.assigned_volunteer && (
                        <p className="text-blue-600">
                          🤝 Assigned to: {request.assigned_volunteer.full_name}
                          {request.assigned_volunteer.phone && ` (${request.assigned_volunteer.phone})`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📨 Messages</CardTitle>
            <CardDescription>Updates about your requests</CardDescription>
          </CardHeader>
          <CardContent>
            {localMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No messages yet</p>
            ) : (
              <div className="space-y-3">
                {localMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`border rounded-lg p-3 ${!message.is_read ? "bg-blue-50 border-blue-200" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">{message.title}</h4>
                      <span className="text-xs text-gray-500">{new Date(message.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{message.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
