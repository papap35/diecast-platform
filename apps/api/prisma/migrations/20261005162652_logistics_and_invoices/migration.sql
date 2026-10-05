-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('MOCK', 'ECPAY');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'IN_TRANSIT', 'ARRIVED', 'PICKED_UP', 'RETURNED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'VOID_PENDING', 'VOIDED', 'ALLOWANCE_ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "logisticsType" TEXT NOT NULL,
    "logisticsSubType" TEXT NOT NULL,
    "merchantTradeNo" TEXT NOT NULL,
    "logisticsId" TEXT,
    "shipmentNo" TEXT,
    "validationNo" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "statusCode" TEXT,
    "statusMessage" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "randomNumber" TEXT,
    "allowanceNo" TEXT,
    "amount" INTEGER NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_merchantTradeNo_key" ON "Shipment"("merchantTradeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_status_nextAttemptAt_idx" ON "Invoice"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
