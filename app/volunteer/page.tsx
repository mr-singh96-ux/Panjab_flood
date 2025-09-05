"use client";
// export const dynamic = "force-dynamic"
import dynamic from "next/dynamic";
const VolunteerDashboard = dynamic(() => import("@/components/volunteer-dashboard"), { ssr: false });
// export const dynamic = "force-dynamic"



export default function VolunteerPage() {
  
  return <VolunteerDashboard />
}
