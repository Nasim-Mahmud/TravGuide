import { Link } from 'react-router';

export default function Footer() {
  return (
    <footer className="border-t border-hairline py-6 px-4">
      <p className="text-center text-body-sm text-ink-faint max-w-2xl mx-auto">
        Atlas — a personal travel record · Boundaries:{' '}
        Natural Earth · geoBoundaries (CC-BY 4.0) · OCHA COD-AB via HDX (CC BY-IGO)
        {' · '}
        <Link to="/about" className="underline decoration-hairline-strong underline-offset-2 hover:text-accent transition-colors">
          About &amp; methodology
        </Link>
      </p>
    </footer>
  );
}
