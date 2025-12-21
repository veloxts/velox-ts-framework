/**
 * Settings Page
 *
 * A React Server Component for application settings.
 * Demonstrates route groups: (dashboard)/settings.tsx -> /settings
 * The (dashboard) folder groups related pages without affecting the URL.
 */

interface PageProps {
  params: Record<string, string>;
  searchParams: Record<string, string | string[]>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const tab = (searchParams.tab as string) || 'general';

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p className="page-description">
        Manage your application settings. This page is in the (dashboard) route group.
      </p>

      <nav className="settings-tabs">
        <a href="/settings?tab=general" className={tab === 'general' ? 'active' : ''}>
          General
        </a>
        <a href="/settings?tab=notifications" className={tab === 'notifications' ? 'active' : ''}>
          Notifications
        </a>
        <a href="/settings?tab=security" className={tab === 'security' ? 'active' : ''}>
          Security
        </a>
      </nav>

      <section className="settings-content">
        {tab === 'general' && (
          <div className="settings-section">
            <h2>General Settings</h2>
            <form className="settings-form">
              <div className="form-group">
                <label htmlFor="siteName">Site Name</label>
                <input type="text" id="siteName" defaultValue="My VeloxTS App" />
              </div>
              <div className="form-group">
                <label htmlFor="timezone">Timezone</label>
                <select id="timezone" defaultValue="UTC">
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
              <button type="submit">Save Changes</button>
            </form>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="settings-section">
            <h2>Notification Settings</h2>
            <form className="settings-form">
              <div className="form-group">
                <label>
                  <input type="checkbox" defaultChecked /> Email notifications
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" /> Push notifications
                </label>
              </div>
              <button type="submit">Save Changes</button>
            </form>
          </div>
        )}

        {tab === 'security' && (
          <div className="settings-section">
            <h2>Security Settings</h2>
            <form className="settings-form">
              <div className="form-group">
                <label>
                  <input type="checkbox" defaultChecked /> Two-factor authentication
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" defaultChecked /> Session timeout after 30 minutes
                </label>
              </div>
              <button type="submit">Save Changes</button>
            </form>
          </div>
        )}
      </section>

      <footer className="page-footer">
        <p>
          <small>Route group: (dashboard) | Layout: DashboardLayout</small>
        </p>
      </footer>
    </div>
  );
}
