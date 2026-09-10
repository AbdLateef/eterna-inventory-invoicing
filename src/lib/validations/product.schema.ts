import { z } from "zod";

export const createProductSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required"),
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().optional().nullable(),
  unitPrice: z
    .number({ message: "Unit price must be a number" })
    .int("Unit price must be an integer (minor units/cents)")
    .min(0, "Unit price must be greater than or equal to 0"),
  quantityOnHand: z
    .number({ message: "Quantity on hand must be a number" })
    .int("Quantity on hand must be an integer")
    .min(0, "Quantity on hand must be greater than or equal to 0"),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
