-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "homeDeliveryFee" INTEGER NOT NULL DEFAULT 120,
    "homeFreeShippingThreshold" INTEGER NOT NULL DEFAULT 1500,
    "cvsFee" INTEGER NOT NULL DEFAULT 60,
    "cvsFreeShippingThreshold" INTEGER NOT NULL DEFAULT 1000,
    "paymentTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "limitedPaymentTimeoutMinutes" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- 只允許一列設定，數值不可為負
ALTER TABLE "StoreSettings"
  ADD CONSTRAINT "StoreSettings_singleton" CHECK ("id" = 1),
  ADD CONSTRAINT "StoreSettings_non_negative" CHECK (
    "homeDeliveryFee" >= 0 AND "homeFreeShippingThreshold" >= 0
    AND "cvsFee" >= 0 AND "cvsFreeShippingThreshold" >= 0
    AND "paymentTimeoutMinutes" > 0 AND "limitedPaymentTimeoutMinutes" > 0
  );

-- 預設值
INSERT INTO "StoreSettings" ("id") VALUES (1);
