import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { formatDate } from '@/lib/utils/formatters';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">
          Logs de Auditoria Administrativa
        </h1>
      </div>

      <div className="bg-surface rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#101010] text-muted uppercase tracking-wider font-semibold border-b border-white/10">
              <tr>
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Ação</th>
                <th className="p-4">Entidade</th>
                <th className="p-4">ID da Entidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted">
                    Nenhum log de alteração registrado até o momento.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-muted">{formatDate(log.createdAt)}</td>
                    <td className="p-4 font-bold text-focus">{log.action}</td>
                    <td className="p-4 text-white">{log.entity}</td>
                    <td className="p-4 font-mono text-muted">{log.entityId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}