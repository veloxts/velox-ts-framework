/**
 * Marketing Layout
 *
 * This layout wraps pages in the (marketing) route group.
 * It's automatically applied to all pages in app/pages/(marketing)/*.
 */

import type { ReactNode } from 'react';

interface MarketingLayoutProps {
  children: ReactNode;
  params?: Record<string, string>;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="marketing-layout">
      <div className="marketing-banner">
        <span className="badge">Marketing</span>
        <span>This page uses the marketing layout</span>
      </div>
      {children}
    </div>
  );
}
