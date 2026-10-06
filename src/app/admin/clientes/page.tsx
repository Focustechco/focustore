'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  MapPin,
  Calendar,
  Phone,
  CreditCard,
  Edit2,
  Eye,
  Shield,
  X,
  Save,
  Package,
  Clock,
  Sparkles,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils/formatters';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  role: string;
  image: string | null;
  createdAt: string;
  totalOrders: number;
  totalReviews: number;
  totalSpent: number;
  lastOrderDate: string | null;
  lastOrderStatus: string | null;
  addresses?: any[];
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Customer Detail / Edit Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editRole, setEditRole] = useState('CUSTOMER');
  const [editPhone, setEditPhone] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCustomerDetails = async (id: string) => {
    setSelectedCustomerId(id);
    try {
      setLoadingDetails(true);
      const res = await fetch(`/api/admin/customers/${id}`);
      const data = await res.json();
      if (data.success) {
        setCustomerDetails(data.customer);
        setEditRole(data.customer.role);
        setEditPhone(data.customer.phone || '');
        setEditCpf(data.customer.cpf || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/admin/customers/${selectedCustomerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          phone: editPhone,
          cpf: editCpf,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Dados do cliente atualizados com sucesso!' });
        fetchCustomers();
        if (customerDetails) {
          setCustomerDetails({
            ...customerDetails,
            role: editRole,
            phone: editPhone,
            cpf: editCpf,
          });
        }
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao atualizar.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de conexão.' });
    } finally {
      setSaving(false);
    }
  };

  // KPI Calculations
  const totalCustomers = customers.length;
  const customersWithOrders = customers.filter((c) => c.totalOrders > 0).length;
  const totalLTV = customers.reduce((acc, c) => acc + c.totalSpent, 0);
  const averageTicket =
    customersWithOrders > 0 ? totalLTV / customersWithOrders : 0;

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.cpf && c.cpf.includes(search)) ||
      (c.phone && c.phone.includes(search));

    const matchesRole = roleFilter === 'ALL' || c.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Gestão de Clientes & Contas
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Visualize o histórico de compras, ticket médio (LTV), endereços de entrega e perfis cadastrados.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clientes */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Total de Clientes
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{totalCustomers}</span>
              <span className="text-xs text-zinc-500 font-mono">cadastrados</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF6500]">
            <Users size={22} />
          </div>
        </div>

        {/* Compradores Ativos */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Compradores Ativos
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                {customersWithOrders}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                ({totalCustomers > 0 ? Math.round((customersWithOrders / totalCustomers) * 100) : 0}% taxa de compra)
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <UserCheck size={22} />
          </div>
        </div>

        {/* Faturamento LTV Acumulado */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Faturamento LTV
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white font-mono">
                {formatPrice(totalLTV)}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Ticket Médio por Comprador */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              LTV Médio por Cliente
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-[#FF6500] font-mono">
                {formatPrice(averageTicket)}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#FF6500]/10 border border-[#FF6500]/20 flex items-center justify-center text-[#FF6500]">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, CPF ou telefone..."
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
          >
            <option value="ALL">Todos os Perfis de Acesso</option>
            <option value="CUSTOMER">Clientes</option>
            <option value="ADMIN">Administradores</option>
            <option value="MANAGER">Gerentes</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-zinc-500 text-xs animate-pulse">
          Carregando clientes...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-12 text-center space-y-3">
          <Users size={32} className="text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase">Nenhum cliente encontrado</h3>
          <p className="text-xs text-zinc-400">Tente ajustar os filtros de busca.</p>
        </div>
      ) : (
        <div className="bg-[#0D0D0D] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-4">Cliente / Contato</th>
                  <th className="p-4">Documento / Telefone</th>
                  <th className="p-4">Pedidos Realizados</th>
                  <th className="p-4">Total Gasto (LTV)</th>
                  <th className="p-4">Cadastro</th>
                  <th className="p-4">Perfil</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-white/[0.03] transition-colors group">
                    {/* Name & Email */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-white font-bold text-xs uppercase flex-shrink-0">
                          {customer.name?.slice(0, 2) || 'CL'}
                        </div>
                        <div>
                          <span className="font-bold text-white block group-hover:text-[#FF6500] transition-colors">
                            {customer.name}
                          </span>
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Mail size={11} className="text-zinc-500" /> {customer.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Document / Phone */}
                    <td className="p-4 text-[11px] text-zinc-300 font-mono">
                      <div>{customer.cpf || '—'}</div>
                      <div className="text-zinc-500">{customer.phone || 'Sem telefone'}</div>
                    </td>

                    {/* Total Orders */}
                    <td className="p-4">
                      <span className="font-mono font-bold text-white text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 inline-flex items-center gap-1.5">
                        <ShoppingBag size={12} className="text-[#FF6500]" />
                        {customer.totalOrders} {customer.totalOrders === 1 ? 'pedido' : 'pedidos'}
                      </span>
                    </td>

                    {/* Total Spent */}
                    <td className="p-4 font-mono font-bold text-[#FF6500]">
                      {formatPrice(customer.totalSpent)}
                    </td>

                    {/* Registration Date */}
                    <td className="p-4 font-mono text-zinc-400 text-[11px]">
                      {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          customer.role === 'ADMIN'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : customer.role === 'MANAGER'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-zinc-800 text-zinc-300 border border-white/10'
                        }`}
                      >
                        {customer.role === 'ADMIN' && <Shield size={10} />}
                        {customer.role === 'ADMIN'
                          ? 'Admin'
                          : customer.role === 'MANAGER'
                          ? 'Gerente'
                          : 'Cliente'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCustomerDetails(customer.id)}
                        className="gap-1.5 bg-white/5 hover:bg-[#FF6500] hover:text-white text-zinc-300 border-white/10 text-[11px] py-1 px-2.5 h-8"
                      >
                        <Eye size={12} />
                        <span>Ver Perfil</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Cliente */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#101010] border border-white/15 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6500]/10 border border-[#FF6500]/30 flex items-center justify-center text-[#FF6500] font-black text-base uppercase">
                  {customerDetails?.name?.slice(0, 2) || 'CL'}
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-[#FF6500] font-bold uppercase">
                    CRM // PERFIL DO CLIENTE
                  </span>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    {customerDetails?.name || 'Cliente'}
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">{customerDetails?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-12 text-center text-zinc-500 text-xs animate-pulse">
                Carregando histórico e dados do cliente...
              </div>
            ) : customerDetails ? (
              <div className="space-y-6">
                {/* Resumo de Compras */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#161616] p-4 rounded-2xl border border-white/5 text-xs text-center">
                  <div>
                    <span className="text-zinc-500 uppercase font-semibold text-[10px] block">
                      Total de Pedidos
                    </span>
                    <span className="text-lg font-mono font-black text-white">
                      {customerDetails.orders?.length || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase font-semibold text-[10px] block">
                      Total Investido (LTV)
                    </span>
                    <span className="text-lg font-mono font-black text-[#FF6500]">
                      {formatPrice(customerDetails.totalSpent || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase font-semibold text-[10px] block">
                      Data de Cadastro
                    </span>
                    <span className="text-sm font-mono font-bold text-zinc-300">
                      {new Date(customerDetails.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Formulário de Edição de Perfil & Permissões */}
                <form onSubmit={handleUpdateCustomer} className="space-y-4 text-xs bg-[#141414] p-5 rounded-2xl border border-white/5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Shield size={14} className="text-[#FF6500]" /> Permissões & Documentos
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold block">Perfil de Acesso (Role)</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 focus:border-[#FF6500] rounded-xl px-3 py-2 text-white outline-none"
                      >
                        <option value="CUSTOMER">Cliente (Padrão)</option>
                        <option value="MANAGER">Gerente</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold block">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full bg-[#1e1e1e] border border-white/10 focus:border-[#FF6500] rounded-xl px-3 py-2 text-white outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold block">CPF</label>
                      <input
                        type="text"
                        value={editCpf}
                        onChange={(e) => setEditCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full bg-[#1e1e1e] border border-white/10 focus:border-[#FF6500] rounded-xl px-3 py-2 text-white outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={saving}
                      size="sm"
                      className="bg-[#FF6500] hover:bg-[#FF7A1A] text-white gap-1.5 font-bold uppercase tracking-wider text-xs"
                    >
                      <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>

                {/* Histórico de Pedidos */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag size={14} className="text-[#FF6500]" /> Histórico de Pedidos ({customerDetails.orders?.length || 0})
                  </h3>

                  {customerDetails.orders && customerDetails.orders.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customerDetails.orders.map((order: any) => (
                        <div
                          key={order.id}
                          className="bg-[#141414] p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-white block">
                              Pedido #{order.id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {new Date(order.createdAt).toLocaleString('pt-BR')} • {order.items?.length || 0} itens
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-[#FF6500]">
                              {formatPrice(order.total)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                order.status === 'PAID' || order.status === 'DELIVERED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : order.status === 'CANCELLED'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic bg-[#141414] p-4 rounded-xl border border-white/5">
                      Nenhum pedido realizado até o momento.
                    </p>
                  )}
                </div>

                {/* Endereços de Entrega */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <MapPin size={14} className="text-[#FF6500]" /> Endereços Cadastrados ({customerDetails.addresses?.length || 0})
                  </h3>

                  {customerDetails.addresses && customerDetails.addresses.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {customerDetails.addresses.map((addr: any) => (
                        <div
                          key={addr.id}
                          className="bg-[#141414] p-3 rounded-xl border border-white/5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{addr.recipientName}</span>
                            {addr.isDefault && (
                              <span className="px-1.5 py-0.5 rounded bg-[#FF6500]/20 text-[#FF6500] text-[9px] font-bold uppercase">
                                Padrão
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-400 text-[11px]">
                            {addr.street}, {addr.number} {addr.complement || ''}
                          </p>
                          <p className="text-zinc-500 font-mono text-[10px]">
                            {addr.neighborhood} - {addr.city}/{addr.state} • CEP {addr.postalCode}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic bg-[#141414] p-4 rounded-xl border border-white/5">
                      Nenhum endereço cadastrado.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
