"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ApiDocsPage() {
  useEffect(() => {
    // Dynamically load Swagger UI CSS and JS from CDN to prevent React StrictMode deprecation warnings
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.SwaggerUIBundle) {
        // @ts-ignore
        window.SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [
            // @ts-ignore
            window.SwaggerUIBundle.presets.apis,
            // @ts-ignore
            window.SwaggerUIBundle.SwaggerUIStandalonePreset,
          ],
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white py-4 px-6 border-b border-gray-800 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-bold">StockFlow API Documentation (Swagger)</h1>
          <p className="text-xs text-gray-400">
            Interactive OpenAPI 3.0 specification for StockFlow endpoints
          </p>
        </div>
        <Link
          href="/products"
          className="text-xs font-semibold px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          &larr; Back to App
        </Link>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div id="swagger-ui"></div>
      </main>
    </div>
  );
}
