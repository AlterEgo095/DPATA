// /dashboard/settings — Redirect to the real API-backed settings page.
// P4-B (Fix B2): the previous version saved to localStorage only
// ("Simulate API call" comment). The real page is at /dashboard/admin/settings
// and persists via PUT /api/admin/settings. To avoid breaking existing
// bookmarks/sidebar links, we issue a server-side redirect.

import { redirect } from 'next/navigation';

export default function SettingsPageRedirect() {
  redirect('/dashboard/admin/settings');
}
