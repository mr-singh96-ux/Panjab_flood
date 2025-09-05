"use client";
export const dynamic = "force-dynamic"
import VictimDashboard from "@/components/victim-dashboard"
// export const dynamic = "force-dynamic"
import { useEffect, useState } from "react";

const [queue, setQueue] = useState<string | null>(null);

function handleResize() {
  // Add your resize logic here if needed
}

useEffect(() => {
  setQueue(localStorage.getItem("queue"));
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);
export default function VictimPage() {
  return <VictimDashboard />
}
