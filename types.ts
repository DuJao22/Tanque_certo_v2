export type FuelType = 'DIESEL' | 'GASOLINA' | 'GASOLINA_ADITIVADA' | 'ETANOL_COMUM' | 'ETANOL_ADITIVADO';

export type UserRole = 'SUPERADMIN' | 'GERENTE' | 'CAIXA' | 'FRENTISTA' | 'OPERADOR';

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

export interface Product {
  id: number;
  barcode: string;
  name: string;
  price: number;
  category?: string;
  internal_qty?: number;
  external_qty?: number;
}

export interface ProductSale {
  id: number;
  product_id: number;
  posto_id: number;
  user_id: number;
  qty: number;
  price_at_sale: number;
  timestamp: number;
  product_name?: string;
  user_name?: string;
  posto_name?: string;
}

export interface SystemLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  posto_id: number | null;
  timestamp: number;
  user_name: string;
  posto_name?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  salesByProduct: {
    name: string;
    total_qty: number;
    total_revenue: number;
  }[];
  dailySales: {
    sale_date: string;
    total: number;
  }[];
}
