/**
 * Minimal Content Layout
 *
 * The content portion of the minimal layout, separate from the HTML document shell.
 * This component is shared between server and client for proper hydration.
 *
 * Server renders: <div id="root"><MinimalContent><Page /></MinimalContent></div>
 * Client hydrates: <MinimalContent><Page /></MinimalContent>
 *
 * This ensures the React tree matches on both sides, enabling proper hydration.
 */

import type { ReactNode } from 'react';

interface MinimalContentProps {
  children: ReactNode;
}

export default function MinimalContent({ children }: MinimalContentProps) {
  return (
    <div className="minimal-content">
      {children}
    </div>
  );
}
