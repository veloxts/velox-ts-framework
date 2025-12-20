/**
 * Profile Page
 *
 * A React Server Component for user profile management.
 * Demonstrates route groups: (dashboard)/profile.tsx -> /profile
 * Uses DashboardLayout via the (dashboard) route group.
 */

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

export default async function ProfilePage(_props: PageProps) {
  // In a real app, this would come from auth context
  const mockUser = {
    name: 'Demo User',
    email: 'demo@veloxts.dev',
    role: 'Administrator',
    joinedAt: new Date('2024-01-01'),
  };

  return (
    <div className="profile-page">
      <h1>Profile</h1>
      <p className="page-description">
        Manage your profile information. This page shares the DashboardLayout with Settings.
      </p>

      <section className="profile-card">
        <div className="profile-avatar">
          <span className="avatar-placeholder">
            {mockUser.name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="profile-info">
          <h2>{mockUser.name}</h2>
          <p className="role">{mockUser.role}</p>
        </div>
      </section>

      <section className="profile-details">
        <h3>Account Details</h3>
        <dl>
          <dt>Email</dt>
          <dd>{mockUser.email}</dd>

          <dt>Role</dt>
          <dd>{mockUser.role}</dd>

          <dt>Member Since</dt>
          <dd>{mockUser.joinedAt.toLocaleDateString()}</dd>
        </dl>
      </section>

      <section className="profile-actions">
        <h3>Quick Actions</h3>
        <nav className="action-links">
          <a href="/settings">Edit Settings</a>
          <a href="/settings?tab=security">Change Password</a>
          <a href="/users">View All Users</a>
        </nav>
      </section>

      <footer className="page-footer">
        <p>
          <small>
            Route group: (dashboard) | Layout: DashboardLayout
          </small>
        </p>
      </footer>
    </div>
  );
}
