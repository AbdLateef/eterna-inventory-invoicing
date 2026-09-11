"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { formatCurrency } from "@/lib/formatters";

interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  product?: {
    id: string;
    sku: string;
    name: string;
    quantityOnHand: number;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string | null;
  dueDate: string | null;
  status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
  items: InvoiceItem[];
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        throw new Error(data.error || "Invoice not found");
      }
      const data = await res.json();
      setInvoice(data);
    } catch (err: any) {
      setError(err.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleStatusTransition = async (newStatus: "ISSUED" | "PAID" | "CANCELLED") => {
    setActionLoading(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to transition status to ${newStatus}`);
      }

      setInvoice(data);
      setActionSuccess(`Invoice status successfully updated to ${newStatus}`);
    } catch (err: any) {
      setActionError(err.message || "Status update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-amber-100 text-amber-800">
            DRAFT
          </span>
        );
      case "ISSUED":
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
            ISSUED
          </span>
        );
      case "PAID":
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-emerald-100 text-emerald-800">
            PAID
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-rose-100 text-rose-800">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600 mb-2"></div>
            <p>Loading invoice details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
          <div className="p-6 bg-white rounded-lg shadow border border-gray-200 text-center space-y-4">
            <p className="text-rose-600 font-medium">{error || "Invoice not found"}</p>
            <Link
              href="/invoices"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              Back to Invoices
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/invoices"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-1 inline-block"
            >
              &larr; Back to Invoices
            </Link>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Invoice {invoice.invoiceNumber}
              </h1>
              {getStatusBadge(invoice.status)}
            </div>
          </div>

          {/* Status Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "DRAFT" && (
              <>
                <button
                  onClick={() => handleStatusTransition("ISSUED")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? "Processing..." : "Issue Invoice (DRAFT → ISSUED)"}
                </button>
                <button
                  onClick={() => handleStatusTransition("CANCELLED")}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-rose-300 text-rose-700 bg-white text-sm font-medium rounded-md hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 transition-colors"
                >
                  Cancel Invoice
                </button>
              </>
            )}

            {invoice.status === "ISSUED" && (
              <>
                <button
                  onClick={() => handleStatusTransition("PAID")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? "Processing..." : "Mark as Paid"}
                </button>
                <button
                  onClick={() => handleStatusTransition("CANCELLED")}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-rose-300 text-rose-700 bg-white text-sm font-medium rounded-md hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 transition-colors"
                >
                  Cancel & Restore Stock
                </button>
              </>
            )}

            {(invoice.status === "PAID" || invoice.status === "CANCELLED") && (
              <span className="text-xs text-gray-500 italic bg-gray-100 px-3 py-1.5 rounded border border-gray-200">
                This invoice is in terminal state ({invoice.status}) and cannot be modified.
              </span>
            )}
          </div>
        </div>

        {/* Action Notifications */}
        {actionError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-sm">
            <strong>Action Error:</strong> {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm">
            {actionSuccess}
          </div>
        )}

        {/* Invoice Printable Card */}
        <div className="bg-white shadow rounded-lg border border-gray-200 p-8 space-y-6">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row justify-between border-b border-gray-200 pb-6 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Billed To
              </p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                {invoice.customerName}
              </h2>
              {invoice.notes && (
                <p className="text-sm text-gray-600 mt-2 max-w-sm">
                  <strong>Notes:</strong> {invoice.notes}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Invoice Details
              </p>
              <p className="text-sm text-gray-700">
                <span className="text-gray-500">Number:</span>{" "}
                <span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span>
              </p>
              <p className="text-sm text-gray-700">
                <span className="text-gray-500">Issue Date:</span>{" "}
                {invoice.issueDate
                  ? new Date(invoice.issueDate).toLocaleDateString("id-ID")
                  : new Date(invoice.createdAt).toLocaleDateString("id-ID")}
              </p>
              {invoice.dueDate && (
                <p className="text-sm text-gray-700">
                  <span className="text-gray-500">Due Date:</span>{" "}
                  {new Date(invoice.dueDate).toLocaleDateString("id-ID")}
                </p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Items
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Item Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {item.productName}
                        {item.product && (
                          <span className="block text-xs text-gray-500">
                            SKU: {item.product.sku} | Current Available Stock: {item.product.quantityOnHand}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center font-medium">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-bold text-right">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="border-t border-gray-200 pt-4 flex justify-end">
            <div className="w-full sm:w-72 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax (PPN 11%)</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(invoice.taxAmount)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-bold text-gray-900">
                <span>Grand Total</span>
                <span className="text-blue-600">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
