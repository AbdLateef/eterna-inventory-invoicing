# StockFlow — Inventory & Invoicing System

StockFlow is a simple internal web app for a small distribution business that tracks the products it holds in stock and bills its customers with invoices.
This solves the problem of their existing process - managing everything in a spreadsheet which leads to overselling stock they do not actually have.

---

## Quick Start & Installation

### Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: Local or cloud PostgreSQL instance

### 1. Clone the Repository
```bash
git clone git@github.com:AbdLateef/eterna-inventory-invoicing.git
cd eterna-inventory-invoicing
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy the example environment file and configure your local PostgreSQL connection:
```bash
cp .env.example .env
```

Edit `.env` if necessary:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eterna-inventory-invoicing?schema=public"
JWT_SECRET="eterna-inventory-invoicing-secret-key-2026-development"
TAX_RATE="11"
```

### 4. Generate Client & Run Database Migrations
Generate Prisma Client types and run database migrations:
```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Seed the Database
Populate the database with a demo user and initial product catalog:
```bash
npm run db:seed
```

### 6. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Demo Credentials

After running `npm run db:seed`, you can log in immediately with:

- **Email**: `demo@stockflow.com`
- **Password**: `Password123!`

*(The demo account comes pre-loaded with 5 active products).*

---

## Running Automated Tests

Run the test suite with a single command:

```bash
npm test
```

### Test Coverage (Requirement N4)
The test suite in [`tests/requirements.test.ts`](tests/requirements.test.ts) verifies all 5 mandatory business rules:

1. **Auth Failure**: Login with an incorrect password is rejected with `401 Unauthorized`.
2. **Unauthenticated Guard**: Unauthenticated API requests return `401 Unauthorized`.
3. **Stock Guard**: Creating an invoice line item exceeding available `quantityOnHand` is rejected with `400 Bad Request`.
4. **Atomic Decrement**: Transitioning an invoice from `DRAFT → ISSUED` decrements product stock atomically.
5. **Atomic Restoration**: Cancelling an `ISSUED` invoice restores the consumed product stock atomically.

---

## API Documentation (Swagger & Endpoint Reference)

### Interactive Swagger UI
When the dev server is running, access the interactive Swagger UI directly in your browser:
**[http://localhost:3000/docs](http://localhost:3000/docs)**

*(OpenAPI 3.0 specification file is located at [`public/openapi.json`](public/openapi.json)).*

### Endpoint Summary Table

All `/api/products` and `/api/invoices` endpoints require authentication via the `token` httpOnly cookie.

| Category | Method | Endpoint | Description | Request Body | Status Codes |
|---|---|---|---|---|---|
| **Auth** | `POST` | `/api/auth/register` | Register new user account | `{ email, password }` | `201`, `400`, `409` |
| **Auth** | `POST` | `/api/auth/login` | Login & set httpOnly JWT cookie | `{ email, password }` | `200`, `401` |
| **Auth** | `POST` | `/api/auth/logout` | Logout & clear auth cookie | — | `200` |
| **Products** | `GET` | `/api/products` | List products (paginated + search by name/SKU) | Query params: `page`, `limit`, `search` | `200`, `401` |
| **Products** | `POST` | `/api/products` | Create a new product | `{ sku, name, description?, unitPrice, quantityOnHand }` | `201`, `400`, `401` |
| **Products** | `GET` | `/api/products/:id` | Get single product detail | — | `200`, `401`, `404` |
| **Products** | `PUT` | `/api/products/:id` | Update product details | `{ sku?, name?, description?, unitPrice?, quantityOnHand? }` | `200`, `400`, `401`, `404` |
| **Products** | `DELETE` | `/api/products/:id` | Soft-delete product (frees SKU for reuse) | — | `200`, `401`, `404` |
| **Invoices** | `GET` | `/api/invoices` | List invoices (paginated + filter by status) | Query params: `page`, `limit`, `status` | `200`, `401` |
| **Invoices** | `POST` | `/api/invoices` | Create invoice (calculates totals server-side) | `{ customerName, issueDate?, dueDate?, notes?, items: [{ productId, quantity }] }` | `201`, `400`, `401` |
| **Invoices** | `GET` | `/api/invoices/:id` | Get single invoice detail with items | — | `200`, `401`, `404` |
| **Invoices** | `PUT` | `/api/invoices/:id` | Update draft invoice lines & totals | `{ customerName?, issueDate?, dueDate?, notes?, items? }` | `200`, `400`, `401`, `404` |
| **Invoices** | `PATCH` | `/api/invoices/:id/status` | Transition status (`ISSUED`, `PAID`, `CANCELLED`) | `{ status }` | `200`, `400`, `401`, `404` |

---

## Tech Choices & Architecture Decisions

1. **Next.js 16 (App Router) + TypeScript**: Single unified framework for frontend pages and serverless API route handlers.
2. **Prisma 7 ORM with PostgreSQL Driver Adapter (`@prisma/adapter-pg`)**: Complies with Prisma 7 SQL driver adapter requirements, enabling type-safe database queries and atomic transactions (`prisma.$transaction`).
3. **Authentication via httpOnly Cookies**: Uses standard JWT (`jose` library) stored inside an `httpOnly` cookie rather than `localStorage` or Bearer tokens to protect against XSS token extraction.
4. **Money Representation in Integer Minor Units (Rupiah)**: All prices and totals are stored as integers (e.g. `15000000` for Rp 15.000.000) to eliminate floating-point rounding errors. Tax calculation uses integer floor division (`Math.floor(subtotal * 11 / 100)`).
5. **Product Snapshotting on Line Items**: `productName` and `unitPrice` are snapshotted directly onto `InvoiceItem` records upon creation. Subsequent price changes or product updates never mutate existing historical invoices.
6. **Soft Delete for Referenced Products**: Deleting a product sets `deletedAt` and renames the SKU (`SKU_deleted_TIMESTAMP`) so invoice history remains intact while freeing the original SKU code for new active products.
7. **Atomic Stock Management & Guard**: `DRAFT → ISSUED` and `ISSUED → CANCELLED` execute stock validation and stock adjustments inside a single PostgreSQL database transaction (`prisma.$transaction`).

---

## Trade-offs & Known Limitations

- **Per-User Workspace Isolation**: Each user functions as an isolated workspace. Products and invoices created by user A are inaccessible to user B.
- **Sequential Invoice Numbers**: Invoice numbers follow a global auto-incrementing `INV-YYYY-XXXX` format to enforce global database uniqueness.
- **Pagination Limit**: List API endpoints cap pagination at 100 items per request to keep memory consumption predictable.

---

## What You Would Do With One More Week

1. **Role-Based Access Control (RBAC)**: Add `ADMIN` and `STAFF` roles where staff members can manage inventory and create invoices but cannot soft-delete products.
2. **Invoice PDF Generation**: Provide a downloadable/printable PDF for customer delivery.
3. **Containerization**: Provide a `docker-compose.yml` to spin up PostgreSQL and the Next.js app in one command.
4. **Stock Movement Ledger**: An append-only audit trail logging every stock increment/decrement reason (e.g., restock, invoice issue, invoice cancellation).

---

## AI Usage

This project was built in collaboration with **Antigravity IDE Assistant** (powered by Gemini & Claude models). I used AI as a pair programming partner for the basic scaffolding, boilerplate, and some utility functions. However, I always reviewed, refined, and tested the generated code.

**Tools & Workflows**:
- **Architecture & Schema Design**: Guidance on Prisma 7 driver adapter setup, soft-delete design pattern, and money integer representation.
- **Boilerplate & Validation**: Rapid generation of Zod schemas, JWT middleware handlers, and API route handlers.
- **UI Components**: Crafting Tailwind CSS components with explicit light-mode contrast styling.
- **Integration Tests**: Writing end-to-end integration tests using Vitest.

All generated code was thoroughly reviewed, refined, compiled, and verified via automated test suites and production builds.

---

## Time Spent

- **Active Development Time**: Approximately 8 hours of focused design, coding, testing, and documentation across two sessions.
- **Timeline**:
  - **Session 1 (Late Night)**: ~4.5 hours (Setup, Prisma 7 driver adapter, Auth API/UI, Products API/UI, Invoice API)
  - **Overnight Rest Break**: 2:00 AM – 9:30 AM
  - **Session 2 (Next Morning/Afternoon)**: ~3.5 hours (Invoice UI, Seed script, Vitest automated tests, Swagger OpenAPI documentation, and final polish)
