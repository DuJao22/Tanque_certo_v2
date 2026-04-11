import { FuelType } from '../types';
import { 
  DIESEL_TABLE, 
  GASOLINA_TABLE, 
  GASOLINA_ADITIVADO_TABLE,
  ETANOL_COMUM_TABLE, 
  ETANOL_ADITIVADO_TABLE 
} from '../constants';

const tableMap = {
  'DIESEL': DIESEL_TABLE,
  'GASOLINA': GASOLINA_TABLE,
  'GASOLINA_ADITIVADA': GASOLINA_ADITIVADO_TABLE,
  'ETANOL_COMUM': ETANOL_COMUM_TABLE,
  'ETANOL_ADITIVADO': ETANOL_ADITIVADO_TABLE,
};

export const getVolume = (fuelId: FuelType, h: number): number | null => {
  const table = tableMap[fuelId];
  if (!table) return null;
  if (h < 0 || h > 260) return null;

  const baseTens = Math.floor(h / 10) * 10;
  const digit = h % 10;
  const row = table[baseTens];
  if (!row) return null;
  
  const val = row[digit];
  return val !== undefined ? val : null;
};
