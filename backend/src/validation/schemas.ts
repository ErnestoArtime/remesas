import { z } from 'zod';

const phone = z.string().trim().min(8).max(24);

export const quoteRequestSchema = z.object({
  amountDelivered: z.coerce.number().min(20).max(1500),
  deliveryMethod: z.string().trim().min(1).max(64).default('usd_cash'),
  municipality: z.string().trim().min(1).max(120).default('havana'),
  deliverySpeed: z.enum(['standard', 'priority']),
  paymentOptionId: z.string().trim().min(1).max(80),
}).strict();

export const createOrderSchema = z.object({
  quoteId: z.string().uuid(),
  paymentMethod: z.enum(['usdt', 'euro']).optional(),
  senderName: z.string().trim().min(3).max(120),
  senderPhone: phone,
  beneficiaryName: z.string().trim().min(3).max(120),
  beneficiaryPhone: phone,
  municipality: z.string().trim().min(2).max(120),
  address: z.string().trim().min(8).max(500),
  notes: z.string().trim().max(1000).default(''),
  isSurprise: z.boolean().default(false),
  whatsappConsent: z.boolean().default(false),
}).strict();

export const paymentOptionPatchSchema = z.object({
  enabled: z.boolean().optional(),
  minAmountUsd: z.number().min(0).optional(),
  maxAmountUsd: z.number().positive().optional(),
  minConfirmations: z.number().int().min(0).max(1000).optional(),
  estimatedConfirmationTime: z.string().trim().min(1).max(160).optional(),
  warning: z.string().trim().max(500).optional(),
}).strict().refine((value) => (
  value.minAmountUsd === undefined
  || value.maxAmountUsd === undefined
  || value.maxAmountUsd >= value.minAmountUsd
), { message: 'El máximo debe ser mayor o igual al mínimo' });

export const deliveryMethodPatchSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().positive().optional(),
  fee: z.number().min(0).optional(),
  estimatedMinHours: z.number().int().min(0).max(720).optional(),
  estimatedMaxHours: z.number().int().min(0).max(720).optional(),
  description: z.string().trim().max(500).optional(),
}).strict();

const serviceAnnouncementObjectSchema = z.object({
  message: z.string().trim().min(1).max(280),
  type: z.enum(['info', 'promotion', 'warning']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean(),
}).strict();

export const serviceAnnouncementSchema = serviceAnnouncementObjectSchema.refine(
  (value) => Date.parse(value.endsAt) > Date.parse(value.startsAt),
  { message: 'La fecha final debe ser posterior a la inicial' },
);

export const serviceAnnouncementPatchSchema = serviceAnnouncementObjectSchema.partial().strict();

export const agentCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(24),
  zone: z.string().trim().min(2).max(120),
}).strict();

export const agentPatchSchema = z.object({
  active: z.boolean(),
}).strict();

export const assignmentSchema = z.object({
  agentId: z.string().uuid(),
}).strict();

export const deliveryFeeSchema = z.object({
  deliveryFee: z.coerce.number().min(0).max(10000),
}).strict();

export const deliveryStatusSchema = z.object({
  status: z.enum(['assigned', 'out_for_delivery', 'delivered', 'failed', 'cancelled']),
}).strict();
