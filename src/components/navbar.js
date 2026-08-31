import { Link, useLocation } from 'react-router-dom';

// Persistent nav bar shown on every screen behind RequireProfile (Welcome,
// Settings, Recipes, Meal Plan, Shopping List) so you can jump directly
// between features instead of routing back through Welcome each time.
// Deliberately kept separate from the per-screen "Back" buttons added in
// Day 4 — those still go straight Home, this just adds a faster path
// between the other screens. No logout button here on purpose: that stays
// on Welcome for now, this is scoped to navigation only.
const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/meal-plan', label: 'Meal Plan' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/shopping-list', label: 'Shopping List' },
  { to: '/settings', label: 'Settings' },
];

export default function NavBar() {
  const location = useLocation();

  return (
    <nav
      style={{
        display: 'flex',
        gap: '10px',
        padding: '12px 20px',
        borderBottom: '1px solid #eee',
        flexWrap: 'wrap',
      }}
    >
      {NAV_LINKS.map(({ to, label }) => {
        const isActive = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            style={{
              padding: '6px 12px',
              textDecoration: 'none',
              color: isActive ? '#fff' : '#333',
              background: isActive ? '#333' : 'transparent',
              borderRadius: '4px',
              fontWeight: isActive ? 'bold' : 'normal',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}