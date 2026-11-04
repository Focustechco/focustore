import React from 'react';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { getAuthenticatedUser } from '@/lib/auth/session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    redirect('/login?returnTo=/admin');
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#080808] text-white print:bg-white print:text-black print:min-h-0 print:block print:p-0">
      <div className="print:hidden">
        <AdminSidebar />
      </div>
      <main className="flex-1 overflow-y-auto min-h-[calc(100vh-60px)] lg:max-h-screen print:p-0 print:m-0 print:overflow-visible print:max-h-none print:w-full print:block print:bg-white">
        {children}
      </main>
    </div>
  );
}
