import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { MotionConfig } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import ToastStack from './Toast';

/**
 * App shell (children pattern — Layout renders {children}, App wraps <Routes>).
 * Footer only appears on scrollable routes (/stats, /about); the map route
 * keeps chrome minimal (design.md §7.11).
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const scrollable = pathname.startsWith('/stats') || pathname.startsWith('/about');
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[100dvh] flex flex-col bg-paper text-ink font-sans">
        <Navbar />
        <main className="flex-1 flex flex-col relative">{children}</main>
        {scrollable && <Footer />}
        <div className="grain-overlay" aria-hidden="true" />
        <ToastStack />
      </div>
    </MotionConfig>
  );
}
