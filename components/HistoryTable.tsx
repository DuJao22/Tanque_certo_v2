import React, { useState, useEffect } from 'react';
import { Measurement } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TANKS } from '../constants';
import { getVolume } from '../lib/volumetry';
import { useAuth } from './AuthProvider';
import { toast } from 'sonner';
import { Edit2, Trash2, Check, X, Loader2 } from 'lucide-react';

export const HistoryTable: React.FC = React.memo(() => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editHeight, setEditHeight] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/measurements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch measurements');
      const data = await res.json();
      setMeasurements(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (m: Measurement) => {
    setEditingId(m.id);
    setEditHeight(m.height.toString());
  };

  const handleSaveEdit = async (m: Measurement) => {
    const h = parseInt(editHeight);
    if (isNaN(h) || h < 0 || h > 260) {
      toast.error("Altura inválida");
      return;
    }

    const volume = getVolume(m.fuel_id, h);
    if (volume === null) return;

    setActionLoading(m.id);
    try {
      const res = await fetch(`/api/measurements/${m.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ height: h, volume })
      });

      if (res.ok) {
        toast.success("Medição atualizada!");
        setEditingId(null);
        fetchData();
      } else {
        toast.error("Erro ao atualizar.");
      }
    } catch (e) {
      toast.error("Erro de conexão.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta medição?")) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/measurements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) {
        toast.success("Medição excluída!");
        fetchData();
      } else {
        toast.error("Erro ao excluir.");
      }
    } catch (e) {
      toast.error("Erro de conexão.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-center py-10">Carregando histórico...</div>;

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-zinc-50">
          <TableRow>
            <TableHead className="font-bold">Data/Hora</TableHead>
            <TableHead className="font-bold">Tanque</TableHead>
            <TableHead className="font-bold">Combustível</TableHead>
            <TableHead className="font-bold">Régua (cm)</TableHead>
            <TableHead className="font-bold">Volume (L)</TableHead>
            <TableHead className="font-bold">Posto ID</TableHead>
            {user?.role !== 'OPERADOR' && <TableHead className="font-bold text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {measurements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={user?.role !== 'OPERADOR' ? 7 : 6} className="text-center py-10 text-muted-foreground">
                Nenhuma medição encontrada.
              </TableCell>
            </TableRow>
          ) : (
            measurements.map((m) => {
              const tank = TANKS.find(t => t.code === m.tank_code);
              const isEditing = editingId === m.id;

              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {format(m.timestamp, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{m.tank_code}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${tank?.labelColor.replace('text-', 'bg-') || 'bg-gray-400'}`} />
                      {tank?.shortName || m.fuel_id}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">
                    {isEditing ? (
                      <Input 
                        type="number" 
                        value={editHeight} 
                        onChange={e => setEditHeight(e.target.value)}
                        className="w-20 h-8"
                        autoFocus
                      />
                    ) : (
                      m.height
                    )}
                  </TableCell>
                  <TableCell className="font-black">
                    {isEditing ? (
                      <span className="text-zinc-400">
                        {getVolume(m.fuel_id, parseInt(editHeight))?.toLocaleString('pt-BR') || '---'}
                      </span>
                    ) : (
                      m.volume.toLocaleString('pt-BR')
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">#{m.posto_id}</Badge>
                  </TableCell>
                  {user?.role !== 'OPERADOR' && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button 
                              size="icon-xs" 
                              variant="default" 
                              onClick={() => handleSaveEdit(m)}
                              disabled={actionLoading === m.id}
                            >
                              {actionLoading === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </Button>
                            <Button 
                              size="icon-xs" 
                              variant="ghost" 
                              onClick={() => setEditingId(null)}
                              disabled={actionLoading === m.id}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              size="icon-xs" 
                              variant="ghost" 
                              onClick={() => handleEdit(m)}
                              disabled={actionLoading !== null}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="icon-xs" 
                              variant="ghost" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(m.id)}
                              disabled={actionLoading !== null}
                            >
                              {actionLoading === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  </div>
);
});
