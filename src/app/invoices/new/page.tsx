"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { formatCurrency } from "@/lib/formatters";

interface Product {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantityOnHand: number;
}

interface FormLineItem {
  productId: string;
  quantity: number;
}

export default function CreateInvoicePage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<FormLineItem[]>([
    { productId: "", quantity: 1 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products?limit=100");
        if (res.ok) {
          const data = await res.json();
          setProducts(data.data || []);
        }
      } catch {
        setError("Failed to load products list");
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof FormLineItem,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Live calculations
  const calculatedItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const unitPrice = product ? product.unitPrice : 0;
    const lineTotal = unitPrice * item.quantity;
    return {
      ...item,
      product,
      unitPrice,
      lineTotal,
    };
  });

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = Math.floor((subtotal * 11) / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!customerName.trim()) {
      setError("Customer name is required");
      return;
    }

    if (items.length === 0 || items.some((item) => !item.productId)) {
      setError("Please select a valid product for every item line.");
      return;
    }

    // Client-side stock check
    for (const item of calculatedItems) {
      if (item.product && item.quantity > item.product.quantityOnHand) {
        setError(
          `Cannot invoice product "${item.product.name}" with quantity (${item.quantity}) exceeding available stock (${item.product.quantityOnHand}).`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim(),
        issueDate: issueDate ? new Date(issueDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
        })),
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }
        throw new Error(data.error || "Failed to create invoice");
      }

      router.push(`/invoices/${data.id}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/invoices"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 mb-2 inline-block"
            >
              &larr; Back to Invoices
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Create New Invoice</h1>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer & Dates Card */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
              Invoice Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PT Mitra Sejahtera"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {fieldErrors.customerName && (
                  <p className="mt-1 text-xs text-rose-600">
                    {fieldErrors.customerName.join(", ")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Payment terms, bank details, or delivery notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                + Add Item Line
              </button>
            </div>

            {loadingProducts ? (
              <p className="text-sm text-gray-500 py-4">Loading products...</p>
            ) : products.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                No active products available. Please{" "}
                <Link href="/products" className="underline font-semibold">
                  add products
                </Link>{" "}
                first.
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => {
                  const calc = calculatedItems[index];
                  const selectedProduct = calc.product;
                  const isStockWarning =
                    selectedProduct &&
                    item.quantity > selectedProduct.quantityOnHand;

                  return (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* Product Selector */}
                        <div className="sm:col-span-5">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Product #{index + 1}
                          </label>
                          <select
                            required
                            value={item.productId}
                            onChange={(e) =>
                              handleItemChange(index, "productId", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.sku} - {p.name} ({formatCurrency(p.unitPrice)} | Stock: {p.quantityOnHand})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Line Total Display */}
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Line Total
                          </label>
                          <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm font-semibold text-gray-900 text-right">
                            {formatCurrency(calc.lineTotal)}
                          </div>
                        </div>

                        {/* Remove Action */}
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            disabled={items.length <= 1}
                            className="p-2 text-gray-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Remove Line"
                          >
                            &times;
                          </button>
                        </div>
                      </div>

                      {/* Stock availability info / error */}
                      {selectedProduct && (
                        <div className="flex justify-between items-center text-xs">
                          <span
                            className={
                              isStockWarning
                                ? "text-rose-600 font-medium"
                                : "text-gray-500"
                            }
                          >
                            Unit price: {formatCurrency(selectedProduct.unitPrice)} | Available Stock:{" "}
                            <strong>{selectedProduct.quantityOnHand}</strong>
                            {isStockWarning && " (Exceeds stock!)"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Summary Card */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax (PPN 11%)</span>
              <span className="font-semibold text-gray-900">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-bold text-gray-900">
              <span>Grand Total</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Form Submit & Cancel Actions */}
          <div className="flex justify-end space-x-3">
            <Link
              href="/invoices"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || products.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving Draft..." : "Save Invoice as Draft"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
