import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  ChevronRight,
  Filter,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from './AuthProvider';
import { DashboardStats } from '../types';

export const SalesDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [postos, setPostos] = useState<{id: number, name: string}[]>([]);
  const [selectedPostoId, setSelectedPostoId] = useState<string>('');

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      fetchPostos();
    } else {
      setSelectedPostoId(user?.posto_id?.toString() || '');
    }
  }, [user]);

  useEffect(() => {
    if (selectedPostoId) {
      fetchStats();
    }
  }, [selectedPostoId]);

  const fetchPostos = async () => {
    try {
      const res = await fetch('/api/postos', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPostos(data);
        if (data.length > 0 && !selectedPostoId) {
          setSelectedPostoId(data[0].id.toString());
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/stats?posto_id=${selectedPostoId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">Dashboard de Vendas</h1>
          <p className="text-zinc-500">Acompanhamento de performance de produtos</p>
        </div>

        {user?.role === 'SUPERADMIN' && (
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
            <Filter className="w-4 h-4 text-zinc-400 ml-2" />
            <Select value={selectedPostoId} onValueChange={setSelectedPostoId}>
              <SelectTrigger className="w-[200px] border-none focus:ring-0">
                <SelectValue placeholder="Selecionar Posto" />
              </SelectTrigger>
              <SelectContent>
                {postos.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-3xl shadow-sm border-zinc-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Receita Total (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-zinc-900">
              R$ {stats?.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Em tempo real
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-sm border-zinc-200 col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Top Produtos por Receita
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.salesByProduct.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}} 
                  contentStyle={{borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'}}
                />
                <Bar dataKey="total_revenue" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl shadow-sm border-zinc-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-zinc-400" />
            Tendência de Vendas (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats?.dailySales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="sale_date" 
                fontSize={10} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(val) => {
                    const date = new Date(val + 'T00:00:00');
                    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                }}
              />
              <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
              <Tooltip 
                contentStyle={{borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'}}
              />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#18181b" 
                strokeWidth={3} 
                dot={{r: 4, fill: '#18181b', strokeWidth: 2, stroke: '#fff'}} 
                activeDot={{r: 6}}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-sm border-zinc-200">
        <CardHeader>
          <CardTitle>Listagem Detalhada por Produto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-100">
            {stats?.salesByProduct.map((p, i) => (
              <div key={i} className="py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-100 transition-colors">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900">{p.name}</div>
                    <div className="text-xs text-zinc-500">{p.total_qty} unidades vendidas</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-black text-zinc-900">R$ {p.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Volume Total</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
