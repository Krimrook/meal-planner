import { Link, useLocation } from 'react-router-dom';

// Persistent nav bar shown on every screen behind RequireProfile, so you can
// jump directly between features instead of routing back through Welcome.
// Day 10: gained the Prices screen and a Log Out button (which used to live
// only on Welcome), and moved its styling into app.css (.navbar).
const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/meal-plan', label: 'Meal Plan' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/shopping-list', label: 'Shopping List' },
  { to: '/prices', label: 'Prices' },
  { to: '/settings', label: 'Settings' },
];

export default function NavBar({ onLogout }) {
  const location = useLocation();

  return (
    <nav className="navbar" aria-label="Main">
      {NAV_LINKS.map(({ to, label }) => {
        const isActive = location.pathname === to;
        return (
          <Link key={to} to={to} className={isActive ? 'active' : undefined} aria-current={isActive ? 'page' : undefined}>
            {label}
          </Link>
        );
      })}
      {onLogout && (
        <>
          <span className="spacer" />
          <button onClick={onLogout}>Log Out</button>
        </>
      )}
    </nav>
  );
}
