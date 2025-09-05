import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-red-50">
      <div className="w-full max-w-sm">
        <Card className="border-green-200">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-green-600">📧 Check Your Email</CardTitle>
            <CardDescription>We've sent you a confirmation link</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Please check your email and click the confirmation link to activate your account.
            </p>
            <p className="text-xs text-gray-500">Don't see the email? Check your spam folder.</p>
            <Link href="/">
              <Button variant="outline" className="w-full bg-transparent">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
