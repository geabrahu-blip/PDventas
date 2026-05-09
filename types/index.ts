export type Role = 'admin' | 'user';

export interface User {
  id: string; // Firebase Auth UID
  name: string;
  email: string;
  role: Role;
  storeId?: string; // assigned store for standard user
}

export interface Product {
  id: string;
  image: string; // base64 or URL
  priceBs: number;
  units: number;
  totalPrice: number; // calculated
  wholesalePrice: number;
  sellingPrice: number;
  name: string;

  // New optional fields for compatibility
  brand?: string;
  category?: string;
  gender?: string; // e.g. 'Mujer' | 'Varón' | 'Unisex'
  capacity?: string; // e.g., '100 ml', '50 g'
  categoryType?: string; // e.g., 'Skincare', 'Makeup'
  barcode?: string;
  skinType?: string;
  expirationDate?: string;
  isCrueltyFree?: boolean;
  isVegan?: boolean;
  hasSpf?: boolean;

}

export interface InventoryItem {
  id: string; // unique ID for this inventory entry
  productId: string; // reference to the original product/purchase
  storeId: string; // 'bodega' or specific store ID
  units: number; // current stock in this store

  // Denormalized fields for easy access without joining
  name: string;
  brand?: string;
  category?: string;
  gender?: string;
  capacity?: string;
  categoryType?: string;
  barcode?: string;
  skinType?: string;
  expirationDate?: string;
  isCrueltyFree?: boolean;
  isVegan?: boolean;
  hasSpf?: boolean;
  image: string;
  priceBs: number;
  wholesalePrice: number;
  sellingPrice: number;

}

export interface PublicCatalogItem {
  id: string; // matches inventory item id
  productId: string;
  storeId: string;
  units: number;
  name: string;
  brand?: string;
  category?: string;
  gender?: string;
  capacity?: string;
  categoryType?: string;
  skinType?: string;
  expirationDate?: string;
  isCrueltyFree?: boolean;
  isVegan?: boolean;
  hasSpf?: boolean;
  image: string;
  sellingPrice: number;
  // NO priceBs or wholesalePrice

}

export interface Purchase {
  id: string;
  name: string;
  date: string;
  createdAt: number;
}

export interface Store {
  id: string;
  name: string;
  location?: string;
}

export interface Transfer {
  id: string;
  productId: string;
  fromStoreId: string; // 'bodega' or store.id
  toStoreId: string;
  quantity: number;
  date: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  storeId: string;
  clientName: string;
  items: SaleItem[];
  total: number; // subtotal minus discount
  globalDiscount?: number; // amount of discount applied to the total
  paymentMethod: 'Cash' | 'QR';
  date: string;
}
