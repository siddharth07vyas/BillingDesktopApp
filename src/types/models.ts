/** Every user-named entity keeps the English name it was entered with plus an optional Hindi name. */
export interface Category {
  id: number;
  name: string;
  nameHi: string | null;
  sortOrder: number;
}

export interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
  nameHi: string | null;
}

export interface Product {
  id: number;
  name: string;
  nameHi: string | null;
  categoryId: number;
  subcategoryId: number | null;
  unit: string;
  price: number;
  costPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  sku: string | null;
  isActive: boolean;
}

export interface Party {
  id: number;
  name: string;
  nameHi: string | null;
  phone: string | null;
  address: string | null;
  balance: number;
}

export type LedgerEntryType = 'sale' | 'payment' | 'manual';

export interface PartyLedgerEntry {
  id: number;
  partyId: number;
  type: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  billId: number | null;
  createdAt: string;
}

export type PaymentMode = 'cash' | 'udhar' | 'split';

export interface Bill {
  id: number;
  number: string;
  partyId: number | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  paymentMode: PaymentMode;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface BillItem {
  id: number;
  billId: number;
  productId: number;
  nameSnapshot: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'return';

export interface StockMovement {
  id: number;
  productId: number;
  type: StockMovementType;
  qtyChange: number;
  note: string | null;
  referenceBillId: number | null;
  referencePurchaseId: number | null;
  createdAt: string;
}

export interface Purchase {
  id: number;
  supplier: string;
  total: number;
  paidAmount: number;
  createdAt: string;
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number;
  nameSnapshot: string;
  qty: number;
  unitCost: number;
}

export interface DayClosing {
  id: number;
  date: string;
  openingCash: number;
  countedCash: number;
  expectedCash: number;
  difference: number;
  note: string | null;
  createdAt: string;
}

export interface CartLine {
  productId: number;
  qty: number;
}
