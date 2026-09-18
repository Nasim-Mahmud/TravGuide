import { Link } from 'react-router';

/** 404 card (map.md §8): "Lost at sea." over the paper canvas */
export default function NotFoundCard() {
  return (
    <div className="atlas-card-lg p-8 max-w-sm w-full text-center animate-fade-up">
      <img
        src="/logo.svg"
        alt=""
        width={56}
        height={56}
        className="mx-auto motion-safe:animate-[atlas-compass-sway_400ms_ease-out_1]"
      />
      <h1 className="font-display font-medium text-display-lg text-ink mt-4">Lost at sea.</h1>
      <p className="text-body text-ink-soft mt-1">This place isn't on the atlas yet.</p>
      <Link
        to="/map"
        className="inline-block mt-5 h-10 leading-10 px-5 rounded-sm bg-accent text-paper-raised text-label uppercase font-semibold hover:bg-accent-strong transition-colors"
      >
        Back to the world map
      </Link>
    </div>
  );
}
