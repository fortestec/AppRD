export type PartCategory =
  | 'Óleos & Fluidos'
  | 'Transmissão'
  | 'Freios'
  | 'Motor & Ignição'
  | 'Filtros'
  | 'Elétrica'
  | 'Pneus & Câmaras'
  | 'Suspensão & Direção'
  | 'Outros';

export const PART_CATEGORIES: PartCategory[] = [
  'Óleos & Fluidos',
  'Transmissão',
  'Freios',
  'Motor & Ignição',
  'Filtros',
  'Elétrica',
  'Pneus & Câmaras',
  'Suspensão & Direção',
  'Outros',
];

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  brand: string;
  category: PartCategory;
  compatibleBikes: string;
  quantity: number;
  minQuantity: number;
  costPrice: number;
  salePrice: number;
  location: string;
  photoDataUrl?: string;
  updatedAt: string;
}

export type QuoteLineType = 'part' | 'service';

export interface QuoteLineItem {
  id: string;
  inventoryId?: string;
  type: QuoteLineType;
  description: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  photoDataUrl?: string;
}

export type QuoteStatus = 'pending' | 'approved' | 'completed';

export interface Quote {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  bikeModel: string;
  bikePlate: string;
  bikeMileage: string;
  items: QuoteLineItem[];
  discountType: 'fixed' | 'percent';
  discountValue: number;
  notes: string;
  validityDays: number;
  status: QuoteStatus;
  stockDeducted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePreset {
  id: string;
  name: string;
  defaultPrice: number;
}

export interface WorkshopSettings {
  name: string;
  phone: string;
  address: string;
  document: string;
  pixKey: string;
  defaultValidityDays: number;
  defaultNotes: string;
  nextQuoteSequence: number;
  servicePresets: ServicePreset[];
}
