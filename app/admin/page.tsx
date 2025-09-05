"use client";
// export const dynamic = "force-dynamic"
import dynamic from "next/dynamic";

const AdminDashboard = dynamic(() => import("@/components/admin-dashboard"), { ssr: false });

export default function AdminPage() {
  return <AdminDashboard />
}
