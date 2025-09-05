// Script to analyze Supabase performance and security issues
const csvUrls = [
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Supabase%20Performance%20Security%20Lints%20%28mdzfwbawlrukoikbgikj%29%20%282%29-WwCaUE9qgwLLcURBSteWNR9PuqLLOP.csv",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Supabase%20Performance%20Security%20Lints%20%28mdzfwbawlrukoikbgikj%29-B6nNT58LwuZhMla5HRb7OlCA9iILZ0.csv",
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Supabase%20Performance%20Security%20Lints%20%28mdzfwbawlrukoikbgikj%29%20%281%29-nqg1MazvagYGPHC9Wtl6vcTIjTBEOl.csv",
]

async function analyzeLints() {
  console.log("[v0] Analyzing Supabase performance and security issues...")

  const allIssues = []

  for (const url of csvUrls) {
    try {
      const response = await fetch(url)
      const csvText = await response.text()

      // Parse CSV manually (simple approach)
      const lines = csvText.split("\n")
      const headers = lines[0].split(",").map((h) => h.replace(/"/g, ""))

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(",").map((v) => v.replace(/"/g, ""))
          const issue = {}
          headers.forEach((header, index) => {
            issue[header] = values[index] || ""
          })
          allIssues.push(issue)
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching CSV:", error)
    }
  }

  // Group issues by type
  const securityIssues = allIssues.filter((issue) => issue.categories && issue.categories.includes("SECURITY"))

  const performanceIssues = allIssues.filter((issue) => issue.categories && issue.categories.includes("PERFORMANCE"))

  console.log("[v0] Security Issues Found:", securityIssues.length)
  securityIssues.forEach((issue) => {
    console.log(`[v0] - ${issue.title}: ${issue.detail}`)
  })

  console.log("[v0] Performance Issues Found:", performanceIssues.length)
  performanceIssues.forEach((issue) => {
    console.log(`[v0] - ${issue.title}: ${issue.detail}`)
  })

  return { securityIssues, performanceIssues }
}

// Run analysis
analyzeLints().then(({ securityIssues, performanceIssues }) => {
  console.log("[v0] Analysis complete. Creating fixes...")
})
