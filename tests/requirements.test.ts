import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { AuthService, AuthError } from "@/services/auth.service";
import { ProductService } from "@/services/product.service";
import { InvoiceService, InvoiceError } from "@/services/invoice.service";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("StockFlow Mandatory Requirements Tests (N4)", () => {
  let testUserId: string;
  const testUserEmail = `testuser_${Date.now()}@example.com`;
  const testUserPassword = "Password123!";

  beforeAll(async () => {
    // Register test user
    const user = await AuthService.register({
      email: testUserEmail,
      password: testUserPassword,
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.invoiceItem.deleteMany({
        where: { invoice: { userId: testUserId } },
      });
      await prisma.invoice.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.product.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.delete({
        where: { id: testUserId },
      });
    }
  });

  // (a) login with a wrong password is rejected
  it("(a) login with a wrong password is rejected", async () => {
    await expect(
      AuthService.login({
        email: testUserEmail,
        password: "WrongPassword123!",
      })
    ).rejects.toThrow(AuthError);

    try {
      await AuthService.login({
        email: testUserEmail,
        password: "WrongPassword123!",
      });
    } catch (error: any) {
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Invalid email or password");
    }
  });

  // (b) an unauthenticated request to a protected route returns 401
  it("(b) an unauthenticated request to a protected route returns 401", async () => {
    const unauthenticatedReq = new NextRequest("http://localhost:3000/api/products", {
      method: "GET",
    });

    const response = await middleware(unauthenticatedReq);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe("Unauthorized access");
  });

  // (c) invoicing more than the available stock is rejected
  it("(c) invoicing more than the available stock is rejected", async () => {
    const product = await ProductService.createProduct(testUserId, {
      sku: `TEST-STOCK-${Date.now()}`,
      name: "Limited Stock Product",
      unitPrice: 100000,
      quantityOnHand: 5,
    });

    await expect(
      InvoiceService.createInvoice(testUserId, {
        customerName: "Test Customer",
        items: [
          {
            productId: product.id,
            quantity: 10, // Exceeds available stock (5)
          },
        ],
      })
    ).rejects.toThrow(InvoiceError);

    try {
      await InvoiceService.createInvoice(testUserId, {
        customerName: "Test Customer",
        items: [
          {
            productId: product.id,
            quantity: 10,
          },
        ],
      });
    } catch (error: any) {
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain("Insufficient stock");
    }
  });

  // (d) issuing an invoice decrements stock correctly
  it("(d) issuing an invoice decrements stock correctly", async () => {
    const product = await ProductService.createProduct(testUserId, {
      sku: `TEST-DEC-${Date.now()}`,
      name: "Stock Decrement Product",
      unitPrice: 50000,
      quantityOnHand: 20,
    });

    const invoice = await InvoiceService.createInvoice(testUserId, {
      customerName: "Stock Decrement Customer",
      items: [
        {
          productId: product.id,
          quantity: 6,
        },
      ],
    });

    expect(invoice.status).toBe("DRAFT");

    // Stock should not be decremented in DRAFT
    const productBeforeIssue = await ProductService.getProductById(testUserId, product.id);
    expect(productBeforeIssue.quantityOnHand).toBe(20);

    // Transition DRAFT -> ISSUED
    const issuedInvoice = await InvoiceService.transitionStatus(
      testUserId,
      invoice.id,
      "ISSUED"
    );
    expect(issuedInvoice.status).toBe("ISSUED");

    // Stock should now be decremented: 20 - 6 = 14
    const productAfterIssue = await ProductService.getProductById(testUserId, product.id);
    expect(productAfterIssue.quantityOnHand).toBe(14);
  });

  // (e) cancelling an issued invoice restores stock
  it("(e) cancelling an issued invoice restores stock", async () => {
    const product = await ProductService.createProduct(testUserId, {
      sku: `TEST-RESTORE-${Date.now()}`,
      name: "Stock Restore Product",
      unitPrice: 75000,
      quantityOnHand: 15,
    });

    const invoice = await InvoiceService.createInvoice(testUserId, {
      customerName: "Stock Restore Customer",
      items: [
        {
          productId: product.id,
          quantity: 5,
        },
      ],
    });

    // Issue invoice (stock becomes 15 - 5 = 10)
    await InvoiceService.transitionStatus(testUserId, invoice.id, "ISSUED");
    const productAfterIssue = await ProductService.getProductById(testUserId, product.id);
    expect(productAfterIssue.quantityOnHand).toBe(10);

    // Cancel ISSUED invoice (stock should be restored 10 + 5 = 15)
    const cancelledInvoice = await InvoiceService.transitionStatus(
      testUserId,
      invoice.id,
      "CANCELLED"
    );
    expect(cancelledInvoice.status).toBe("CANCELLED");

    const productAfterCancel = await ProductService.getProductById(testUserId, product.id);
    expect(productAfterCancel.quantityOnHand).toBe(15);
  });
});
