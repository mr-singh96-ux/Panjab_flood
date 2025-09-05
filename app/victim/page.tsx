"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VictimPage() {
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    location: "",
    need: "",
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("victimForm");
      if (saved) {
        try {
          setFormData(JSON.parse(saved));
        } catch {
          console.warn("Invalid victimForm data in localStorage");
        }
      }
    }
  }, []);

  // Save draft whenever formData changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("victimForm", JSON.stringify(formData));
    }
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("relief_requests").insert({
      ...formData,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error submitting request:", error);
      alert("Something went wrong. Please try again.");
    } else {
      alert("Request submitted successfully!");
      setFormData({ name: "", contact: "", location: "", need: "" });
      if (typeof window !== "undefined") {
        localStorage.removeItem("victimForm");
      }
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Request Help</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          value={formData.name}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        />
        <input
          type="text"
          name="contact"
          placeholder="Contact Number"
          value={formData.contact}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        />
        <input
          type="text"
          name="location"
          placeholder="Your Location"
          value={formData.location}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        />
        <textarea
          name="need"
          placeholder="Describe your need"
          value={formData.need}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Submit Request
        </button>
      </form>
    </div>
  );
}
