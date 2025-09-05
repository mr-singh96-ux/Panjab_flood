'use client';

import { useEffect, useState } from 'react';
import VictimDashboard from '@/components/victim-dashboard';

export function generateViewport() {
  return {
    viewport: 'width=device-width, initial-scale=1',
    themeColor: '#ff0078',
  };
}

export default function VictimPage() {
  const [queue, setQueue] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // Ensure client-side only
    setQueue(localStorage.getItem("queue")); // Safe now
    const handleResize = () => {
      // resize logic
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!mounted) return null; // Avoid SSR errors

  return <VictimDashboard queue={queue} />;
}
