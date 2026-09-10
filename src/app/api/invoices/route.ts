import { NextRequest, NextResponse } from "next/server";
import { InvoiceService, InvoiceError } from "@/services/invoice.service";
import { createInvoiceSchema, invoiceQuerySchema } from "@/lib/validations/invoice.schema";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    };

    const parsedQuery = invoiceQuerySchema.parse(queryParams);

    const result = await InvoiceService.getInvoices(userId, parsedQuery);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", errors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    if (error instanceof InvoiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createInvoiceSchema.parse(body);

    const invoice = await InvoiceService.createInvoice(userId, validatedData);

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", errors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    if (error instanceof InvoiceError) {
      return NextResponse.json(
        { error: error.message, errors: error.errors },
        { status: error.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
