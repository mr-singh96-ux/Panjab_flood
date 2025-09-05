'use client';
export const runtime = 'nodejs';

export function generateViewport() {
  return {
    viewport: 'width=device-width, initial-scale=1',
    themeColor: '#ff0078',
  };
}

import { useState, useEffect } from 'react';
import VictimDashboard from '@/components/victim-dashboard';

export default function VictimPage() {
  const [queue, setQueue] = useState<string | null>(null);

  useEffect(() => {
    setQueue(localStorage.getItem("queue"));
  }, []);

  return <VictimDashboard />;
}
