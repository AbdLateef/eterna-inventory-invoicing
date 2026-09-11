import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting seed...");

  const demoEmail = "demo@stockflow.com";
  const hashedPassword = await bcrypt.hash("Password123!", 10);

  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      password: hashedPassword,
    },
    create: {
      email: demoEmail,
      password: hashedPassword,
    },
  });

  console.log(`Demo User created/updated: ${demoUser.email} (ID: ${demoUser.id})`);

  const demoProducts = [
    {
      sku: "PROD-001",
      name: "Laptop Pro 15\"",
      description: "High performance workstation laptop with 32GB RAM and 1TB SSD",
      unitPrice: 15000000,
      quantityOnHand: 10,
    },
    {
      sku: "PROD-002",
      name: "Wireless Ergonomic Mouse",
      description: "2.4GHz wireless mouse with adjustable DPI and wrist support",
      unitPrice: 350000,
      quantityOnHand: 50,
    },
    {
      sku: "PROD-003",
      name: "Mechanical Keyboard RGB",
      description: "Tactile mechanical keyboard with custom RGB backlighting",
      unitPrice: 850000,
      quantityOnHand: 25,
    },
    {
      sku: "PROD-004",
      name: "27\" 4K Monitor",
      description: "IPS panel 4K UHD monitor with Type-C power delivery",
      unitPrice: 4500000,
      quantityOnHand: 8,
    },
    {
      sku: "PROD-005",
      name: "USB-C Multiport Adapter",
      description: "7-in-1 USB-C hub with HDMI 4K, 100W PD, and SD card reader",
      unitPrice: 250000,
      quantityOnHand: 40,
    },
    {
      sku: "PROD-006",
      name: "Noise Cancelling Headphones",
      description: "Over-ear wireless headphones with active noise cancellation",
      unitPrice: 2200000,
      quantityOnHand: 15,
    },
    {
      sku: "PROD-007",
      name: "HD Webcam 1080p",
      description: "Full HD webcam with dual microphone and privacy cover",
      unitPrice: 450000,
      quantityOnHand: 30,
    },
    {
      sku: "PROD-008",
      name: "Standing Desk Converter",
      description: "Adjustable height dual monitor desk riser",
      unitPrice: 1800000,
      quantityOnHand: 12,
    },
    {
      sku: "PROD-009",
      name: "Ultra-Wide Gaming Monitor 34\"",
      description: "144Hz curved UWQHD display with HDR400",
      unitPrice: 7500000,
      quantityOnHand: 5,
    },
    {
      sku: "PROD-010",
      name: "Bluetooth Conference Speaker",
      description: "Omnidirectional microphone speakerphone for meeting rooms",
      unitPrice: 1200000,
      quantityOnHand: 18,
    },
    {
      sku: "PROD-011",
      name: "Vertical Ergonomic Mouse",
      description: "Wireless vertical mouse reducing wrist strain and fatigue",
      unitPrice: 420000,
      quantityOnHand: 22,
    },
    {
      sku: "PROD-012",
      name: "Desk Mat Extended XXL",
      description: "Water-resistant felt desk pad mouse pad",
      unitPrice: 150000,
      quantityOnHand: 60,
    },
    {
      sku: "PROD-013",
      name: "Dual Monitor Arm Mount",
      description: "Heavy-duty aluminum gas spring dual monitor stand",
      unitPrice: 890000,
      quantityOnHand: 14,
    },
    {
      sku: "PROD-014",
      name: "Portable SSD 1TB",
      description: "USB 3.2 Gen 2 high speed rugged external SSD",
      unitPrice: 1650000,
      quantityOnHand: 28,
    },
    {
      sku: "PROD-015",
      name: "Smart LED Desk Lamp",
      description: "Dimmable desk lamp with wireless smartphone charger",
      unitPrice: 380000,
      quantityOnHand: 35,
    },
  ];

  for (const prod of demoProducts) {
    const existing = await prisma.product.findFirst({
      where: {
        userId: demoUser.id,
        sku: prod.sku,
        deletedAt: null,
      },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: prod.name,
          description: prod.description,
          unitPrice: prod.unitPrice,
          quantityOnHand: prod.quantityOnHand,
        },
      });
      console.log(`Product updated: [${prod.sku}] ${prod.name}`);
    } else {
      await prisma.product.create({
        data: {
          userId: demoUser.id,
          sku: prod.sku,
          name: prod.name,
          description: prod.description,
          unitPrice: prod.unitPrice,
          quantityOnHand: prod.quantityOnHand,
        },
      });
      console.log(`Product created: [${prod.sku}] ${prod.name}`);
    }
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
