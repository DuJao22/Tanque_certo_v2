export type FuelType = 'DIESEL' | 'GASOLINA' | 'GASOLINA_ADITIVADA' | 'ETANOL_COMUM' | 'ETANOL_ADITIVADO';

export type UserRole = 'SUPERADMIN' | 'GERENTE' | 'OPERADOR';

export interface UserProfile {
  id: number;
  username: string;
  role: UserRole;
  name: string;
  posto_id: number | null;
}

export interface Posto {
  id: number;
  name: string;
}

export interface Measurement {
  id: number;
  tank_code: string;
  fuel_id: FuelType;
  height: number;
  volume: number;
  timestamp: number;
  user_id: number;
  posto_id: number;
  userName?: string; // For UI display
}

export interface TankState {
  code: string;
  posto_id: number;
  fuel_id: FuelType;
  last_height: number;
  last_volume: number;
  last_update: number;
  capacity: number;
  min_stock: number;
}

export interface VolumetricTable {
  [key: number]: number[];
}

export interface FuelConfig {
  id: FuelType;
  name: string;
  color: string;
  table: VolumetricTable;
}

export interface TankDef {
  code: string;
  fuelId: FuelType;
  shortName: string;
  labelColor: string;
  capacity: number;
  minStock?: number;
}
