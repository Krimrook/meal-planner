import { Link } from 'react-router-dom';

export default function Welcome({ user, profile, onLogout }) {
  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
      <h2>Welcome!</h2>
      <p>You're logged in as: {user.email}</p>
      <p>Weekly budget: £{profile.budget}</p>
      <p>Household size: {profile.household_size}</p>
      <p>Preferred supermarket: {profile.preferred_supermarket}</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
        <Link to="/meal-plan">
          <button style={{ padding: '10px 20px', cursor: 'pointer' }}>Meal Plan</button>
        </Link>
        <Link to="/recipes">
          <button style={{ padding: '10px 20px', cursor: 'pointer' }}>Recipes</button>
        </Link>
        <Link to="/shopping-list">
          <button style={{ padding: '10px 20px', cursor: 'pointer' }}>Shopping List</button>
        </Link>
        <Link to="/settings">
          <button style={{ padding: '10px 20px', cursor: 'pointer' }}>Settings</button>
        </Link>
        <button onClick={onLogout} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Log Out
        </button>
      </div>
    </div>
  );
}