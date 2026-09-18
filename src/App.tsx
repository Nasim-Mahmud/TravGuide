import { Navigate, Route, Routes } from 'react-router';
import Layout from '@/components/Layout';
import MapPage from '@/pages/MapPage';
import StatsPage from '@/pages/StatsPage';
import AboutPage from '@/pages/AboutPage';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * Route table (plan §15). One map component hosts every geography level;
 * the URL mirrors the drill path. Layout uses the children pattern
 * (Layout renders {children}, App wraps <Routes>).
 */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/country/:countryId" element={<MapPage />} />
        <Route path="/country/:countryId/:l1slug" element={<MapPage />} />
        <Route path="/country/:countryId/:l1slug/:l2slug" element={<MapPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
