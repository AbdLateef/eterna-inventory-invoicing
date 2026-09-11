import { prisma } from "@/lib/prisma";
import { CreateInvoiceInput, UpdateInvoiceInput, InvoiceStatus } from "@/lib/validations/invoice.schema";

export class InvoiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "InvoiceError";
  }
}

const TAX_RATE = parseInt(process.env.TAX_RATE || "11", 10);

export class InvoiceService {
  private static async generateInvoiceNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        invoiceNumber: true,
      },
    });

    let nextSequence = 1;
    if (latestInvoice) {
      const parts = latestInvoice.invoiceNumber.split("-");
      const lastSeqStr = parts[parts.length - 1];
      const lastSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(lastSeq)) {
        nextSequence = lastSeq + 1;
      }
    }

    const paddedSeq = nextSequence.toString().padStart(4, "0");
    return `${prefix}${paddedSeq}`;
  }

  static async createInvoice(userId: string, input: CreateInvoiceInput) {
    const productIds = input.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        userId,
        deletedAt: null,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new InvoiceError(`Product with ID ${item.productId} not found or has been deleted`, 400);
      }
      if (product.quantityOnHand < item.quantity) {
        throw new InvoiceError(
          `Insufficient stock for product "${product.name}". Available: ${product.quantityOnHand}, Requested: ${item.quantity}`,
          400
        );
      }
    }

    const invoiceItemsData = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const lineTotal = product.unitPrice * item.quantity;
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.unitPrice,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const subtotal = invoiceItemsData.reduce((acc, item) => acc + item.lineTotal, 0);
    const taxAmount = Math.floor((subtotal * TAX_RATE) / 100);
    const total = subtotal + taxAmount;

    const invoiceNumber = await this.generateInvoiceNumber(userId);

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        invoiceNumber,
        customerName: input.customerName,
        issueDate: input.issueDate ? new Date(input.issueDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes,
        status: "DRAFT",
        subtotal,
        taxAmount,
        total,
        items: {
          create: invoiceItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                quantityOnHand: true,
              },
            },
          },
        },
      },
    });

    return invoice;
  }

  static async getInvoices(
    userId: string,
    query: { page: number; limit: number; status?: InvoiceStatus }
  ) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            select: {
              id: true,
              productName: true,
              unitPrice: true,
              quantity: true,
              lineTotal: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getInvoiceById(userId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                quantityOnHand: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new InvoiceError("Invoice not found", 404);
    }

    return invoice;
  }

  static async updateInvoice(userId: string, id: string, input: UpdateInvoiceInput) {
    const existingInvoice = await prisma.invoice.findFirst({
      where: { id, userId },
    });

    if (!existingInvoice) {
      throw new InvoiceError("Invoice not found", 404);
    }

    if (existingInvoice.status !== "DRAFT") {
      throw new InvoiceError("Only invoices in DRAFT state can be updated", 400);
    }

    let subtotal = existingInvoice.subtotal;
    let taxAmount = existingInvoice.taxAmount;
    let total = existingInvoice.total;
    let invoiceItemsData: any[] | undefined = undefined;

    if (input.items && input.items.length > 0) {
      const productIds = input.items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          userId,
          deletedAt: null,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new InvoiceError(`Product with ID ${item.productId} not found or has been deleted`, 400);
        }
        if (product.quantityOnHand < item.quantity) {
          throw new InvoiceError(
            `Insufficient stock for product "${product.name}". Available: ${product.quantityOnHand}, Requested: ${item.quantity}`,
            400
          );
        }
      }

      invoiceItemsData = input.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const lineTotal = product.unitPrice * item.quantity;
        return {
          productId: product.id,
          productName: product.name,
          unitPrice: product.unitPrice,
          quantity: item.quantity,
          lineTotal,
        };
      });

      subtotal = invoiceItemsData.reduce((acc, item) => acc + item.lineTotal, 0);
      taxAmount = Math.floor((subtotal * TAX_RATE) / 100);
      total = subtotal + taxAmount;
    }

    return prisma.$transaction(async (tx) => {
      if (invoiceItemsData) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          customerName: input.customerName ?? existingInvoice.customerName,
          issueDate: input.issueDate !== undefined ? (input.issueDate ? new Date(input.issueDate) : null) : existingInvoice.issueDate,
          dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existingInvoice.dueDate,
          notes: input.notes !== undefined ? input.notes : existingInvoice.notes,
          subtotal,
          taxAmount,
          total,
          ...(invoiceItemsData
            ? {
                items: {
                  create: invoiceItemsData,
                },
              }
            : {}),
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  quantityOnHand: true,
                },
              },
            },
          },
        },
      });

      return updated;
    });
  }

  static async transitionStatus(userId: string, id: string, newStatus: InvoiceStatus) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!invoice) {
      throw new InvoiceError("Invoice not found", 404);
    }

    const currentStatus = invoice.status as InvoiceStatus;

    if (currentStatus === newStatus) {
      return invoice;
    }

    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      DRAFT: ["ISSUED", "CANCELLED"],
      ISSUED: ["PAID", "CANCELLED"],
      PAID: [],
      CANCELLED: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new InvoiceError(
        `Cannot transition invoice status from ${currentStatus} to ${newStatus}`,
        400
      );
    }

    if (currentStatus === "DRAFT" && newStatus === "ISSUED") {
      return prisma.$transaction(async (tx) => {
        for (const item of invoice.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || product.deletedAt !== null) {
            throw new InvoiceError(
              `Product "${item.productName}" not found or deleted`,
              400
            );
          }

          if (product.quantityOnHand < item.quantity) {
            throw new InvoiceError(
              `Cannot issue invoice. Insufficient stock for product "${product.name}". Available: ${product.quantityOnHand}, Required: ${item.quantity}`,
              400
            );
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantityOnHand: {
                decrement: item.quantity,
              },
            },
          });
        }

        const updatedInvoice = await tx.invoice.update({
          where: { id },
          data: { status: "ISSUED" },
          include: { items: true },
        });

        return updatedInvoice;
      });
    }

    if (currentStatus === "ISSUED" && newStatus === "CANCELLED") {
      return prisma.$transaction(async (tx) => {
        for (const item of invoice.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantityOnHand: {
                increment: item.quantity,
              },
            },
          });
        }

        const updatedInvoice = await tx.invoice.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: { items: true },
        });

        return updatedInvoice;
      });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: { status: newStatus },
      include: { items: true },
    });

    return updatedInvoice;
  }
}
