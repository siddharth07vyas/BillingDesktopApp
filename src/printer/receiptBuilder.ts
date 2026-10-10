import { EscPosBuilder } from './escpos';
import type { ShopSettings } from '../db/repositories/settings';
import { formatQty, totalQty } from '../format';

export interface ReceiptLine {
  name: string;
  qty: number;
  price: number;
}

export interface ReceiptInput {
  settings: ShopSettings;
  billNumber: string;
  createdAt: string;
  partyName?: string | null;
  items: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  paymentMode: string;
}

function money(n: number): string {
  return 'Rs.' + n.toFixed(2);
}

function twoCol(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

export function buildReceiptBytes(input: ReceiptInput): Uint8Array {
  const width = input.settings.paperWidth === '58mm' ? 32 : 48;
  const b = new EscPosBuilder().init();

  b.align('center').bold(true).line(input.settings.shopName || 'Shop').bold(false);
  if (input.settings.address) b.line(input.settings.address);
  const contact = [input.settings.phone, input.settings.gstin ? 'GSTIN ' + input.settings.gstin : '']
    .filter(Boolean)
    .join(' - ');
  if (contact) b.line(contact);

  b.align('left').divider('-', width);
  b.line(input.billNumber);
  b.line(new Date(input.createdAt).toLocaleString());
  if (input.partyName) b.line('Party: ' + input.partyName);
  b.divider('-', width);

  for (const item of input.items) {
    b.line(item.name);
    b.line(twoCol(`  ${formatQty(item.qty)} x ${money(item.price)}`, money(item.qty * item.price), width));
  }

  b.divider('-', width);
  b.line(twoCol('Products', String(input.items.length), width));
  b.bold(true).line(twoCol('Total items (qty)', formatQty(totalQty(input.items)), width)).bold(false);
  b.divider('-', width);
  b.line(twoCol('Subtotal', money(input.subtotal), width));
  if (input.discount) b.line(twoCol('Discount', '-' + money(input.discount), width));
  b.bold(true).line(twoCol('Total', money(input.total), width)).bold(false);
  b.line(twoCol(`Paid (${input.paymentMode})`, money(input.paid), width));

  const balanceDue = input.total - input.paid;
  if (balanceDue > 0) {
    b.bold(true).line(twoCol('Balance (udhar)', money(balanceDue), width)).bold(false);
  }

  b.divider('-', width);
  b.align('center').line(input.settings.footer || '');
  b.cut();

  return b.build();
}
