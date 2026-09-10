import { z } from "zod";

export const createInvoiceItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const createInvoiceSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(createInvoiceItemSchema).min(1, "Invoice must contain at least one item"),
});

export const updateInvoiceSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").optional(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(createInvoiceItemSchema).min(1, "Invoice must contain at least one item").optional(),
});

export const invoiceStatusSchema = z.enum(["DRAFT", "ISSUED", "PAID", "CANCELLED"]);

export const statusTransitionSchema = z.object({
  status: invoiceStatusSchema,
});

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: invoiceStatusSchema.optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
