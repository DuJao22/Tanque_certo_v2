import React from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TankDef } from '@/types';
import { Droplet, AlertTriangle } from 'lucide-react';

interface TankCardProps {
  tank: TankDef;
  currentVolume: number;
  currentHeight: number;
  minStock?: number;
  onClick?: () => void;
}

export const TankCard = React.memo<TankCardProps>(({ tank, currentVolume, currentHeight, minStock = 0, onClick }) => {
  const percentage = Math.min(100, Math.max(0, (currentVolume / tank.capacity) * 100));
  const isLowStock = currentVolume > 0 && currentVolume <= minStock;
  
  // Color mapping based on user request
  const getTankColor = (fuelId: string) => {
    switch (fuelId) {
      case 'GASOLINA': return 'bg-red-600';
      case 'GASOLINA_ADITIVADA': return 'bg-blue-600';
      case 'ETANOL_COMUM': return 'bg-green-600';
      case 'ETANOL_ADITIVADO': return 'bg-yellow-400';
      case 'DIESEL': return 'bg-zinc-900';
      default: return 'bg-gray-400';
    }
  };

  const tankColor = getTankColor(tank.fuelId);

  return (
    <Card 
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow border-2 ${isLowStock ? 'border-red-500 animate-pulse' : 'hover:border-primary/20'}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2 space-y-0">
        <div className="flex justify-between items-start">
          <Badge variant="outline" className="font-mono text-[10px]">{tank.code}</Badge>
          {(percentage < 15 || isLowStock) && (
            <div className="flex items-center gap-1">
              {isLowStock && <Badge variant="destructive" className="text-[8px] uppercase">Estoque Crítico</Badge>}
              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
            </div>
          )}
        </div>
        <CardTitle className="text-lg font-bold leading-tight mt-1">
          {tank.shortName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-3xl font-black tracking-tighter">
              {currentVolume.toLocaleString('pt-BR')}
              <span className="text-sm font-normal text-muted-foreground ml-1">L</span>
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Régua: {currentHeight} cm
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {percentage.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="relative h-24 w-full bg-muted rounded-lg overflow-hidden border border-border/50">
          <motion.div 
            className={`absolute bottom-0 left-0 right-0 ${tankColor} opacity-80`}
            initial={{ height: 0 }}
            animate={{ height: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 50, damping: 15 }}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20" />
          </motion.div>
          
          {/* Liquid reflection effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
          
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Droplet className="w-12 h-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
