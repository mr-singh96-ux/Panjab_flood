"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const roleParam = searchParams.get("role")
    if (roleParam) {
      setRole(roleParam)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Redirect based on role
      if (role === "admin") {
        router.push("/admin")
      } else if (role === "volunteer") {
        router.push("/volunteer")
      } else {
        router.push("/victim")
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "victim":
        return "text-red-600"
      case "volunteer":
        return "text-blue-600"
      case "admin":
        return "text-gray-600"
      default:
        return "text-gray-600"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "victim":
        return "🆘"
      case "volunteer":
        return "🤝"
      case "admin":
        return "👨‍💼"
      default:
        return "👤"
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-red-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className={`text-2xl ${getRoleColor(role)}`}>{getRoleIcon(role)} Login</CardTitle>
              <CardDescription>
                {role === "victim" && "Access emergency help requests"}
                {role === "volunteer" && "Access volunteer coordination"}
                {role === "admin" && "Access admin dashboard"}
                {!role && "Enter your credentials to continue"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {!role && (
                    <div className="grid gap-2">
                      <Label htmlFor="role">I am a...</Label>
                      <Select value={role} onValueChange={setRole} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="victim">🆘 Victim (Need Help)</SelectItem>
                          <SelectItem value="volunteer">🤝 Volunteer (Can Help)</SelectItem>
                          <SelectItem value="admin">👨‍💼 Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading || !role}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href={`/auth/sign-up${role ? `?role=${role}` : ""}`} className="underline underline-offset-4">
                    Sign up
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
