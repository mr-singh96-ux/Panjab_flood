import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-red-600">🚨 Flood Relief</h1>
          <p className="text-gray-600">Emergency Coordination System</p>
          <p className="text-sm text-gray-500">Works offline - No internet required</p>
        </div>

        <Card className="border-red-200">
          <CardHeader className="text-center">
            <CardTitle className="text-red-700">Emergency Access</CardTitle>
            <CardDescription>
              Get help or provide assistance during flood emergencies - No signup required!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Link href="/victim">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white">🆘 I Need Help (Victim)</Button>
              </Link>

              <Link href="/volunteer">
                <Button
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 bg-transparent"
                >
                  🤝 I Can Help (Volunteer)
                </Button>
              </Link>

              <Link href="/admin">
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-600 hover:bg-gray-50 bg-transparent"
                >
                  👨‍💼 Admin Access
                </Button>
              </Link>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-center text-gray-500">Emergency access - No account creation needed</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-400">
          <p>✅ Offline Mode Enabled</p>
          <p>Data syncs when connection is restored</p>
        </div>
      </div>
    </div>
  )
}
