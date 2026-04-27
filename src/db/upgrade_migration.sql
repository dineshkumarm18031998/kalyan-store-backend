-- ============================================================
-- UPGRADE MIGRATION — v8 (Pending Item Return Support)
-- Run this in your Supabase SQL Editor ONCE
-- ============================================================

-- 1. Add pending return tracking columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pending_return_date  DATE,
  ADD COLUMN IF NOT EXISTS pending_paid_amount  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_settled      BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_bill_amount  NUMERIC(12,2) DEFAULT 0;

-- 2. Add returned_qty tracking to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS returned_qty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_returned  BOOLEAN DEFAULT FALSE;

-- 3. Backfill: mark existing returned orders
UPDATE orders
SET pending_settled = TRUE
WHERE status = 'returned' AND is_paid = TRUE;

-- 4. Backfill: for returned orders, set returned_qty = quantity on all items
UPDATE order_items oi
SET returned_qty = oi.quantity, is_returned = TRUE
FROM orders o
WHERE oi.order_id = o.id AND o.status = 'returned';

-- 5. Index for pending return queries
CREATE INDEX IF NOT EXISTS idx_orders_pending_items
  ON orders(store_id, status)
  WHERE status IN ('active','partial');

-- Done! Now deploy the v8 backend and mobile code.
