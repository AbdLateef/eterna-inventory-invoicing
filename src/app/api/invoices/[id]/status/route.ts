import { NextRequest, NextResponse } from "next/server";
import { InvoiceService, InvoiceError } from "@/services/invoice.service";
import { statusTransitionSchema } from "@/lib/validations/invoice.schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = statusTransitionSchema.parse(body);

    const invoice = await InvoiceService.transitionStatus(userId, id, status);

    return NextResponse.json(invoice);
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
