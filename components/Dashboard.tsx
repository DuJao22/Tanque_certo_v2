import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TankState, Measurement, Posto } from '../types';
import { TANKS } from '../constants';
import { TankCard } from './TankCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Activity, MapPin } from 'lucide-react';
import { useAuth } from './AuthProvider';

export const Dashboard: React.FC<{ onSelectTank: (code: string) => void }> = React.memo(({ onSelectTank }) => {
  const { user } = useAuth();
  const [tankStates, setTankStates] = useState<Record<string, TankState>>({});
  const [recentMeasurements, setRecentMeasurements] = useState<Measurement[]>([]);
  const [postos, setPostos] = useState<Posto[]>([]);
  const [selectedPostoId, setSelectedPostoId] = useState<string | null>(user?.posto_id?.toString() || null);

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      fetch('/api/postos', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch postos');
        return res.json();
      })
      .then(data => {
        setPostos(data);
        if (data.length > 0 && !selectedPostoId) {
          setSelectedPostoId(data[0].id.toString());
        }
      });
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !selectedPostoId) return;

    try {
      // Fetch Tanks
      const tanksRes = await fetch(`/api/tanks?posto_id=${selectedPostoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!tanksRes.ok) throw new Error('Failed to fetch tanks');
      const tanksData = await tanksRes.json();
      const states: Record<string, TankState> = {};
      tanksData.forEach((t: TankState) => {
        states[t.code] = t;
      });
      setTankStates(states);

      // Fetch Measurements
      const measRes = await fetch(`/api/measurements?posto_id=${selectedPostoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!measRes.ok) throw new Error('Failed to fetch measurements');
      const measData = await measRes.json();
      setRecentMeasurements(measData);
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    }
  }, [selectedPostoId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalVolume = useMemo(() => {
    return Object.values(tankStates).reduce((acc: number, curr: TankState) => acc + curr.last_volume, 0);
  }, [tankStates]);

  const tankCards = useMemo(() => {
    return TANKS.map(tank => {
      const state = tankStates[tank.code];
      return (
        <TankCard 
          key={tank.code}
          tank={{
            ...tank,
            capacity: state?.capacity || tank.capacity
          }}
          currentVolume={state?.last_volume || 0}
          currentHeight={state?.last_height || 0}
          minStock={state?.min_stock || 0}
          onClick={() => onSelectTank(tank.code)}
        />
      );
    });
  }, [tankStates, onSelectTank]);

  const capacitySummary = useMemo(() => {
    return TANKS.map(tank => {
      const state = tankStates[tank.code];
      const perc = state ? (state.last_volume / tank.capacity) * 100 : 0;
      return (
        <div key={tank.code} className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold">
            <span>{tank.code}</span>
            <span>{perc.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full ${tank.labelColor.replace('text-', 'bg-')}`} 
              style={{ width: `${perc}%` }}
            />
          </div>
        </div>
      );
    });
  }, [tankStates]);

  return (
    <div className="space-y-8">
      {user?.role === 'SUPERADMIN' && (
        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="pt-6 flex items-center gap-4">
            <MapPin className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <div className="text-xs font-bold uppercase text-zinc-400 mb-1">Visualizando Posto</div>
              <Select value={selectedPostoId || ''} onValueChange={setSelectedPostoId}>
                <SelectTrigger className="w-full md:w-[300px] font-bold">
                  <SelectValue placeholder="Selecione um posto" />
                </SelectTrigger>
                <SelectContent>
                  {postos.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {tankCards}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {recentMeasurements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma medição registrada ainda.
                  </div>
                ) : (
                  recentMeasurements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-10 rounded-full ${
                          TANKS.find(t => t.code === m.tank_code)?.labelColor.replace('text-', 'bg-') || 'bg-gray-400'
                        }`} />
                        <div>
                          <div className="font-bold text-sm">{m.tank_code}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(m.timestamp, "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg">
                          {m.volume.toLocaleString('pt-BR')} L
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Resumo do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="text-sm font-medium text-muted-foreground mb-1">Volume Total Estocado</div>
              <div className="text-3xl font-black tracking-tighter">
                {totalVolume.toLocaleString()}
                <span className="text-sm font-normal ml-1">L</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-muted-foreground">Capacidade Utilizada</div>
              {capacitySummary}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
