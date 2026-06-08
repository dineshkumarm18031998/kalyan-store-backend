-- ═══════════════════════════════════════════════════
-- KALYAN STORE - Database Tables
-- Run this SQL in Railway PostgreSQL → Data → Query
-- ═══════════════════════════════════════════════════

CREATE TABLE "Store" (
    id TEXT PRIMARY KEY,
    "storeName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    address TEXT,
    lang TEXT NOT NULL DEFAULT 'en',
    "createdBy" TEXT,
    "createdBySignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Product" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "totalQty" INTEGER NOT NULL,
    "rentPerDay" DOUBLE PRECISION NOT NULL,
    deposit DOUBLE PRECISION NOT NULL DEFAULT 0,
    category TEXT,
    image TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_storeId_fkey"
        FOREIGN KEY ("storeId")
        REFERENCES "Store"(id)
        ON DELETE CASCADE
);

CREATE TABLE "Booking" (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    "cName" TEXT NOT NULL,
    "cMob" TEXT NOT NULL,
    "cAddr" TEXT,
    notes TEXT,
    "eventType" TEXT,
    "startDate" TEXT NOT NULL,
    "returnDate" TEXT,
    "totalDays" INTEGER NOT NULL DEFAULT 0,
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
    discount DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    returned BOOLEAN NOT NULL DEFAULT FALSE,
    "actualReturnDate" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT FALSE,
    "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "advanceReturned" BOOLEAN NOT NULL DEFAULT FALSE,
    "generatedBy" TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_storeId_fkey"
        FOREIGN KEY ("storeId")
        REFERENCES "Store"(id)
        ON DELETE CASCADE
);

CREATE TABLE "BookingItem" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    deposit DOUBLE PRECISION NOT NULL DEFAULT 0,
    image TEXT,
    "bookingId" TEXT NOT NULL,
    CONSTRAINT "BookingItem_bookingId_fkey"
        FOREIGN KEY ("bookingId")
        REFERENCES "Booking"(id)
        ON DELETE CASCADE
);

CREATE TABLE "Damage" (
    id TEXT PRIMARY KEY,
    product TEXT NOT NULL,
    qty INTEGER NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Damage_bookingId_fkey"
        FOREIGN KEY ("bookingId")
        REFERENCES "Booking"(id)
        ON DELETE CASCADE
);

CREATE TABLE "Member" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    signature TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_storeId_fkey"
        FOREIGN KEY ("storeId")
        REFERENCES "Store"(id)
        ON DELETE CASCADE
);

CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");
CREATE INDEX "Booking_storeId_idx" ON "Booking"("storeId");
CREATE INDEX "Booking_cMob_idx" ON "Booking"("cMob");
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");
CREATE INDEX "Damage_bookingId_idx" ON "Damage"("bookingId");
CREATE INDEX "Member_storeId_idx" ON "Member"("storeId");
