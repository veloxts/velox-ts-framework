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
      <style>{`
        .marketing-layout {
          position: relative;
        }

        .marketing-banner {
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 1rem 1.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .marketing-banner .badge {
          display: inline-block;
          background: #00d9ff;
          color: #000;
          font-size: 0.625rem;
          text-transform: uppercase;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .marketing-banner span:not(.badge) {
          color: #888;
          font-size: 0.875rem;
        }
      `}</style>

      <div className="marketing-banner">
        <span className="badge">Marketing</span>
        <span>This page uses the marketing layout</span>
      </div>
      {children}
    </div>
  );
}
