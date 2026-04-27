/**
 * dashboard.js — v8
 * Revenue = SUM(total_amount) — total_amount now always = Stage A + Stage B (if charged)
 * Collected = SUM(paid_amount + pending_paid_amount)
 * Pending   = SUM(balance_amount) where balance > 0
 */
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const dayjs  = require('dayjs');

router.get('/dashboard', auth, async (req, res) => {
  const storeId = req.storeId;
  const today   = dayjs().format('YYYY-MM-DD');
  const mStart  = dayjs().startOf('month').format('YYYY-MM-DD');
  try {
    const [
      totalOrdR, activeOrdR,
      totalRevR, collectedR, pendingR,
      overdueR, todayR, prodsR,
      recentR, overdueListR,
      monthR, dmgTotR, dmgCntR,
      returnAmtR, pendingOrdR,
    ] = await Promise.all([

      db.query('SELECT COUNT(*) FROM orders WHERE store_id=$1', [storeId]),

      db.query("SELECT COUNT(*) FROM orders WHERE store_id=$1 AND status IN ('active','partial')", [storeId]),

      // Revenue = sum of total_amount (already includes both stages)
      db.query('SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE store_id=$1', [storeId]),

      // Collected = Stage A paid + Stage B paid
      db.query(`
        SELECT COALESCE(SUM(
          COALESCE(paid_amount,0) + COALESCE(pending_paid_amount,0)
        ),0) as v
        FROM orders WHERE store_id=$1
      `, [storeId]),

      // Pending = outstanding balance across all orders
      db.query(`
        SELECT COALESCE(SUM(balance_amount),0) as v
        FROM orders WHERE store_id=$1 AND balance_amount > 0
      `, [storeId]),

      db.query(`
        SELECT COUNT(*) FROM orders
        WHERE store_id=$1 AND status='active'
          AND (to_date < $2 OR (to_date IS NULL AND from_date < $2::date - interval '7 days'))
      `, [storeId, today]),

      db.query('SELECT COUNT(*) FROM orders WHERE store_id=$1 AND from_date=$2', [storeId, today]),

      db.query('SELECT COUNT(*) FROM products WHERE store_id=$1 AND is_active=true', [storeId]),

      db.query(`
        SELECT o.id, o.order_number, o.customer_name, o.customer_phone,
          o.status, o.is_paid, o.total_amount, o.balance_amount,
          o.paid_amount, o.advance_amount, o.return_amount,
          o.from_date, o.return_date, o.event_type, o.is_vip,
          o.pending_bill_amount, o.pending_paid_amount,
          o.pending_settled, o.pending_covered, o.pending_return_date,
          (SELECT COUNT(*) FROM order_items oi
           WHERE oi.order_id=o.id AND oi.quantity > COALESCE(oi.returned_qty,0)
          ) AS pending_items_count
        FROM orders o WHERE o.store_id=$1
        ORDER BY o.created_at DESC LIMIT 8
      `, [storeId]),

      db.query(`
        SELECT id, order_number, customer_name, customer_phone, to_date
        FROM orders WHERE store_id=$1 AND status='active'
          AND (to_date < $2 OR (to_date IS NULL AND from_date < $2::date - interval '7 days'))
        ORDER BY COALESCE(to_date,from_date) ASC LIMIT 10
      `, [storeId, today]),

      db.query(`
        SELECT COALESCE(SUM(total_amount),0) as v
        FROM orders WHERE store_id=$1 AND from_date >= $2
      `, [storeId, mStart]),

      db.query('SELECT COALESCE(SUM(damage_charges),0) as v FROM orders WHERE store_id=$1', [storeId]),

      db.query('SELECT COUNT(*) FROM orders WHERE store_id=$1 AND damage_charges > 0', [storeId]),

      // Advance refund owed = advance paid that exceeds total bill, not yet settled
      db.query(`
        SELECT COALESCE(SUM(return_amount),0) as v
        FROM orders WHERE store_id=$1 AND return_amount > 0
          AND NOT (is_paid=true AND status='returned')
      `, [storeId]),

      // Orders with items still not returned
      db.query(`
        SELECT COUNT(DISTINCT o.id) FROM orders o
        JOIN order_items oi ON oi.order_id=o.id
        WHERE o.store_id=$1 AND o.status IN ('active','partial')
          AND oi.quantity > COALESCE(oi.returned_qty,0)
      `, [storeId]),
    ]);

    const totalRev  = parseFloat(totalRevR.rows[0].v);
    const collected = Math.min(parseFloat(collectedR.rows[0].v), totalRev);
    const pending   = parseFloat(pendingR.rows[0].v);

    res.json({
      success: true,
      stats: {
        totalOrders:        parseInt(totalOrdR.rows[0].count),
        activeOrders:       parseInt(activeOrdR.rows[0].count),
        totalRevenue:       totalRev,
        collectedRevenue:   collected,
        pendingPayment:     pending,
        monthRevenue:       parseFloat(monthR.rows[0].v),
        overdueReturns:     parseInt(overdueR.rows[0].count),
        todayOrders:        parseInt(todayR.rows[0].count),
        totalProducts:      parseInt(prodsR.rows[0].count),
        damageTotal:        parseFloat(dmgTotR.rows[0].v),
        damageCount:        parseInt(dmgCntR.rows[0].count),
        returnAmount:       parseFloat(returnAmtR.rows[0].v),
        pendingItemsOrders: parseInt(pendingOrdR.rows[0].count),
      },
      recentOrders: recentR.rows,
      overdueList:  overdueListR.rows,
    });
  } catch(e) {
    console.error('Dashboard error:', e);
    res.status(500).json({ success:false, message:'Dashboard failed' });
  }
});

// Monthly revenue last 6 months
router.get('/monthly', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        TO_CHAR(from_date,'Mon') as month,
        TO_CHAR(from_date,'YYYY-MM') as month_key,
        COALESCE(SUM(total_amount),0) as revenue,
        COALESCE(SUM(paid_amount + COALESCE(pending_paid_amount,0)),0) as collected,
        COUNT(*) as orders
      FROM orders
      WHERE store_id=$1 AND from_date >= NOW() - INTERVAL '6 months'
      GROUP BY month_key, month ORDER BY month_key ASC
    `, [req.storeId]);
    res.json({ success:true, months:r.rows });
  } catch(e) { res.status(500).json({ success:false }); }
});

// Customer search
router.get('/customer-search', auth, async (req, res) => {
  const q = req.query.phone || req.query.name || '';
  try {
    const r = await db.query(`
      SELECT customer_name, customer_phone,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount),0) as total_revenue,
        COALESCE(SUM(balance_amount),0) as total_pending,
        MAX(from_date) as last_order
      FROM orders WHERE store_id=$1
        AND (customer_phone ILIKE $2 OR customer_name ILIKE $2)
      GROUP BY customer_name, customer_phone
      ORDER BY total_revenue DESC
    `, [req.storeId, '%'+q+'%']);
    res.json({ success:true, customers:r.rows });
  } catch(e) { res.status(500).json({ success:false }); }
});

module.exports = router;
