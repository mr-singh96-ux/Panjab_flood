"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [location, setLocation] = useState("")
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/${role}`,
          data: {
            full_name: fullName,
            phone: phone,
            location: location,
            role: role,
          },
        },
      })
      if (error) throw error
      router.push("/auth/check-email")
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
              <CardTitle className={`text-2xl ${getRoleColor(role)}`}>{getRoleIcon(role)} Create Account</CardTitle>
              <CardDescription>
                {role === "victim" && "Register to request emergency help"}
                {role === "volunteer" && "Register to help flood victims"}
                {role === "admin" && "Register as system administrator"}
                {!role && "Create your emergency coordination account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Your full name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

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
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="location">Location/Address</Label>
                    <Textarea
                      id="location"
                      placeholder="Your current location or address"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      rows={2}
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
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm">
                  Already have an account?{" "}
                  <Link href={`/auth/login${role ? `?role=${role}` : ""}`} className="underline underline-offset-4">
                    Sign in
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
