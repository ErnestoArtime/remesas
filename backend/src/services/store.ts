import fs from 'fs';
import path from 'path';
import { Agent, Order } from '../models/order';

const DATA_FILE = path.join(__dirname, '../../data/orders.json');
const AGENTS_FILE = path.join(__dirname, '../../data/agents.json');

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

function readAgents(): Agent[] {
  ensureDir();
  if (!fs.existsSync(AGENTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAgents(agents: Agent[]): void {
  ensureDir();
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
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

  findAgents(): Agent[] {
    return readAgents();
  },

  findAgentById(id: string): Agent | undefined {
    return readAgents().find((agent) => agent.id === id);
  },

  saveAgent(agent: Agent): void {
    const agents = readAgents();
    const index = agents.findIndex((item) => item.id === agent.id);
    if (index >= 0) agents[index] = agent;
    else agents.push(agent);
    writeAgents(agents);
  },
};
