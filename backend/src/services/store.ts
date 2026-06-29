import fs from 'fs';
import path from 'path';
import { Order } from '../models/order';

const DATA_FILE = path.join(__dirname, '../../data/orders.json');

function ensureDir(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readAll(): Order[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAll(orders: Order[]): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

export const store = {
  findAll(): Order[] {
    return readAll();
  },

  findByReference(ref: string): Order | undefined {
    return readAll().find((o) => o.reference === ref);
  },

  save(order: Order): void {
    const orders = readAll();
    const idx = orders.findIndex((o) => o.reference === order.reference);
    if (idx >= 0) orders[idx] = order;
    else orders.push(order);
    writeAll(orders);
  },
};
