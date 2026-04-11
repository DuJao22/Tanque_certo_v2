import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TankDef } from '../types';
import { getVolume } from '../lib/volumetry';
import { toast } from 'sonner';
import { Ruler, Calculator, Loader2 } from 'lucide-react';

interface MeasurementModalProps {
  tank: TankDef | null;
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export const MeasurementModal: React.FC<MeasurementModalProps> = ({ tank, isOpen, onClose, userName }) => {
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);

  if (!tank) return null;

  const handleSave = async () => {
    const h = parseInt(height);
    if (isNaN(h) || h < 0 || h > 260) {
      toast.error("Altura inválida (0-260cm)");
      return;
    }

    setLoading(true);
    try {
      const volume = getVolume(tank.fuelId, h);
      if (volume === null) throw new Error("Volume não encontrado");

      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tank_code: tank.code,
          fuel_id: tank.fuelId,
          height: h,
          volume: volume,
          capacity: tank.capacity
        })
      });

      if (res.ok) {
        toast.success("Medição registrada com sucesso!");
        setHeight('');
        onClose();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao salvar medição.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar medição.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" />
            Nova Medição: {tank.shortName}
          </DialogTitle>
          <DialogDescription>
            Insira a altura medida na régua para o tanque {tank.code}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="height">Altura da Régua (cm)</Label>
            <div className="relative">
              <Input 
                id="height"
                type="number"
                placeholder="Ex: 145"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="pl-10 h-12 text-lg font-bold"
                autoFocus
              />
              <Calculator className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          {height && !isNaN(parseInt(height)) && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-center">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Volume Estimado</div>
              <div className="text-2xl font-black tracking-tighter">
                {getVolume(tank.fuelId, parseInt(height))?.toLocaleString('pt-BR') || '---'}
                <span className="text-sm font-normal ml-1">L</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Medição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
