"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function VolunteerPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return

    const loadRequests = async () => {
      const { data, error } = await supabase
        .from("relief_requests")
        .select("*")
        .eq("status", "pending")

      if (error) console.error(error)
      else setRequests(data || [])
    }
    loadRequests()
  }, [supabase])

  return (
    <div>
      <h1>Volunteer Dashboard</h1>
      <ul>
        {requests.map(r => (
          <li key={r.id}>{r.details} — {r.status}</li>
        ))}
      </ul>
    </div>
  )
}
