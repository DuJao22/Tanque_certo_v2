import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  AlertCircle, 
  Info,
  ArrowRight,
  Clock,
  User,
  MapPin,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SystemLog } from '../types';

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/system-logs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.user_name.toLowerCase().includes(filter.toLowerCase()) ||
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    (l.posto_name?.toLowerCase().includes(filter.toLowerCase()))
  );

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'SALE': return <Badge className="bg-green-100 text-green-700 border-green-200">VENDA</Badge>;
      case 'CREATE_MEASUREMENT': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">MEDIÇÃO</Badge>;
      case 'DELETE_MEASUREMENT': return <Badge variant="destructive">EXCLUSÃO</Badge>;
      case 'UPDATE_MEASUREMENT': return <Badge className="bg-amber-100 text-amber-700 border-amber-200">EDIÇÃO</Badge>;
      case 'INVENTORY_TRANSFER': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">TRANSFERÊNCIA</Badge>;
      case 'PRODUCT_MODIFIED': return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">PRODUTO</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

  const renderDetails = (details: string) => {
    try {
        const d = JSON.parse(details);
        return (
            <div className="text-[10px] text-zinc-500 font-mono mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(d).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between border-b border-zinc-50 pb-0.5">
                        <span className="opacity-60">{key}:</span>
                        <span className="font-bold text-zinc-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                ))}
            </div>
        );
    } catch {
        return <div className="text-[10px] text-zinc-500 mt-1">{details}</div>;
    }
  };

  if (loading) {
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
          <h1 className="text-2xl font-black text-zinc-900">Logs do Sistema</h1>
          <p className="text-zinc-500">Registro de todas as ações e auditoria</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Filtrar logs..." 
            className="pl-10 rounded-xl"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      <Card className="rounded-3xl border-zinc-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Data / Hora</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Ação</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Posto</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-zinc-600">
                        <Clock className="w-3 h-3 opacity-40" />
                        <span className="text-sm font-medium">
                          {format(log.timestamp, "dd/MM HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center">
                          <User className="w-3 h-3 text-zinc-400" />
                        </div>
                        <span className="text-sm font-bold text-zinc-900">{log.user_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.posto_name ? (
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <MapPin className="w-3 h-3" />
                          <span className="text-xs">{log.posto_name}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">--</span>
                      )}
                    </td>
                    <td className="px-6 py-4 min-w-[200px]">
                      {renderDetails(log.details)}
                    </td>
                  </tr>
                ))}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-zinc-400">
                        <History className="w-8 h-8 opacity-20" />
                        <p>Nenhum log encontrado para o filtro.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
