import React from 'react';
import { Header } from '@/components/layout/header';
import { NavigationBar } from '@/components/layout/navigation-bar';
import { Footer } from '@/components/layout/footer';

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