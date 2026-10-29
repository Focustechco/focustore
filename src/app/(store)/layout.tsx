import React from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { BenefitsBar } from '@/components/commerce/benefits-bar';
import { BackToHomeButton } from '@/components/layout/back-to-home-button';

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <BenefitsBar />
      <main className="flex-1">
        <BackToHomeButton />
        {children}
      </main>
      <Footer />
    </div>
  );
}
