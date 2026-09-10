import { prisma } from "@/lib/prisma";
import type {
  CreateProductInput,
  ProductQueryInput,
  UpdateProductInput,
} from "@/lib/validations/product.schema";

export class ProductError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ProductError";
  }
}

export class ProductService {
  static async getProducts(userId: string, query: ProductQueryInput) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      deletedAt: null,
    };

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { sku: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  static async getProductById(userId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new ProductError("Product not found", 404);
    }

    return product;
  }

  static async createProduct(userId: string, input: CreateProductInput) {
    const existingSku = await prisma.product.findFirst({
      where: {
        userId,
        sku: input.sku,
        deletedAt: null,
      },
    });

    if (existingSku) {
      throw new ProductError("SKU already exists", 400, {
        sku: ["SKU already exists"],
      });
    }

    try {
      const product = await prisma.product.create({
        data: {
          userId,
          sku: input.sku,
          name: input.name,
          description: input.description,
          unitPrice: input.unitPrice,
          quantityOnHand: input.quantityOnHand,
        },
      });

      return product;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ProductError("SKU already exists", 400, {
          sku: ["SKU already exists"],
        });
      }
      throw error;
    }
  }

  static async updateProduct(
    userId: string,
    id: string,
    input: UpdateProductInput
  ) {
    await this.getProductById(userId, id);

    if (input.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          userId,
          sku: input.sku,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existingSku) {
        throw new ProductError("SKU already exists", 400, {
          sku: ["SKU already exists"],
        });
      }
    }

    try {
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          ...(input.sku && { sku: input.sku }),
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
          ...(input.quantityOnHand !== undefined && {
            quantityOnHand: input.quantityOnHand,
          }),
        },
      });

      return updatedProduct;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new ProductError("SKU already exists", 400, {
          sku: ["SKU already exists"],
        });
      }
      throw error;
    }
  }

  static async deleteProduct(userId: string, id: string) {
    const product = await this.getProductById(userId, id);

    // Soft delete to preserve invoice history, rename SKU to avoid DB unique constraint conflict with new active products
    const deletedSku = `${product.sku}_deleted_${Date.now()}`;

    const deletedProduct = await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        sku: deletedSku,
      },
    });

    return deletedProduct;
  }
}
