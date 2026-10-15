import React from 'react';
import { Header } from '@/components/layout/header';
import { NavigationBar } from '@/components/layout/navigation-bar';
import { Footer } from '@/components/layout/footer';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <NavigationBar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}