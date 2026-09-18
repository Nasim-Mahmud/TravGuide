import { useEffect } from 'react';
import NotFoundCard from '@/components/NotFoundCard';

export default function NotFoundPage() {
  useEffect(() => {
    document.title = 'Lost at sea — Atlas';
  }, []);
  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[60dvh]">
      <NotFoundCard />
    </div>
  );
}
