"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminPage() {
  const supabase = createClient();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending"); // default filter
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Load saved filter from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminFilter");
      if (saved) setFilter(saved);
    }
  }, []);

  // Save filter whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("adminFilter", filter);
    }
  }, [filter]);

  // Fetch requests from Supabase
  const loadRequests = async () => {
    setLoading(true);

    let query = supabase.from("relief_requests").select("*").order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching requests:", error);
    } else {
      setRequests(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [filter]);

  // Update request status
  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    setIsUpdating(requestId);

    const { error } = await supabase
      .from("relief_requests")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", requestId);

    if (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    } else {
      await loadRequests();
    }

    setIsUpdating(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Filter buttons */}
      <div className="flex gap-3 mb-6">
        {["all", "pending", "in_progress", "completed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded ${
              filter === status ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading requests...</p>
      ) : requests.length === 0 ? (
        <p>No requests found.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="border p-4 rounded shadow">
              <p><strong>Name:</strong> {req.name}</p>
              <p><strong>Contact:</strong> {req.contact}</p>
              <p><strong>Location:</strong> {req.location}</p>
              <p><strong>Need:</strong> {req.need}</p>
              <p><strong>Status:</strong> {req.status}</p>

              <div className="mt-3 flex gap-2">
                {["pending", "in_progress", "completed"].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateStatus(req.id, status)}
                    disabled={isUpdating === req.id}
                    className={`px-3 py-1 rounded ${
                      req.status === status
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  >
                    {isUpdating === req.id ? "Updating..." : status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
