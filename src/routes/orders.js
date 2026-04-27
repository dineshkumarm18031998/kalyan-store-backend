/**
 * orders.js — v8 CORRECT LOGIC
 *
 * STAGE A:  PUT /:id with returnDate
 *   → totalAmount = ALL items × days (includes pending items too)
 *   → itemReturns stores returned_qty per item
 *   → status = 'partial' if any item has pending qty
 *
 * STAGE B:  PUT /:id with pendingReturnDate
 *   → pendingBillAmount = ONLY pending items × (returnDate → pendingRetDate) × rate
 *   → If pendingCovered = true  → grandTotal stays same (no extra charge)
 *   → If pendingCovered = false → grandTotal = stageA + pendingBill
 *   → totalAmount, balanceAmount, paidAmount all updated correctly
 *   → Dashboard revenue syncs automatically
 */
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const dayjs  = require('dayjs');

// ── helpers ───────────────────────────────────────────────────────
const daysBetween = (from, to) =>
  Math.max(1, dayjs(to).diff(dayjs(from), 'day') + 1);

function calcItemsBill(items, fromDate, toDate, isVip, customDiscount, damageTotal) {
  const days     = toDate ? daysBetween(fromDate, toDate) : 1;
  const subtotal = items.reduce((s, i) =>
    s + (parseFloat(i.qty || i.quantity || 0)) * parseFloat(i.rate_per_day || 0) * days, 0);
  const vip      = isVip ? Math.floor(subtotal * 0.5) : 0;
  const disc     = parseFloat(customDiscount) || 0;
  const dmg      = parseFloat(damageTotal) || 0;
  const total    = Math.max(0, subtotal - vip - disc) + dmg;
  return { days, subtotal, vip, disc, dmg, total };
}

async function generateOrderNumber(storeId) {
  const r = await db.query('SELECT COUNT(*) as cnt FROM orders WHERE store_id=$1', [storeId]);
  return `KS${String(storeId).padStart(2,'0')}${String(parseInt(r.rows[0].cnt)+1).padStart(4,'0')}`;
}

// ── GET list ──────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let where  = 'WHERE o.store_id=$1';
    const params = [req.storeId];
    let i = 2;
    if (status && status !== 'all') { where += ` AND o.status=$${i++}`; params.push(status); }
    if (search) {
      where += ` AND (o.customer_name ILIKE $${i} OR o.customer_phone ILIKE $${i} OR o.order_number ILIKE $${i})`;
      params.push('%'+search+'%'); i++;
    }
    const [rows, cnt] = await Promise.all([
      db.query(`
        SELECT o.*,
          (SELECT COUNT(*) FROM order_items oi2
           WHERE oi2.order_id=o.id AND oi2.quantity > COALESCE(oi2.returned_qty,0)
          ) AS pending_items_count,
          json_agg(json_build_object(
            'id',oi.id,'product_name',oi.product_name,'emoji',oi.product_emoji,
            'quantity',oi.quantity,'returned_qty',oi.returned_qty,
            'rate_per_day',oi.rate_per_day,'days',oi.days,'subtotal',oi.subtotal
          )) FILTER (WHERE oi.id IS NOT NULL) AS items,
          json_agg(json_build_object(
            'id',di.id,'name',di.name,'quantity',di.quantity,
            'cost_each',di.cost_each,'total_cost',di.total_cost
          )) FILTER (WHERE di.id IS NOT NULL) AS damages
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id=o.id
        LEFT JOIN damage_items di ON di.order_id=o.id
        ${where} GROUP BY o.id ORDER BY o.created_at DESC
        LIMIT $${i} OFFSET $${i+1}
      `, [...params, limit, offset]),
      db.query(`SELECT COUNT(*) FROM orders o ${where}`, params),
    ]);
    res.json({ success:true, orders:rows.rows, total:parseInt(cnt.rows[0].count), page:parseInt(page) });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Failed to fetch orders' });
  }
});

// ── GET one ───────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT o.*,
        (SELECT COUNT(*) FROM order_items oi2
         WHERE oi2.order_id=o.id AND oi2.quantity > COALESCE(oi2.returned_qty,0)
        ) AS pending_items_count,
        json_agg(json_build_object(
          'id',oi.id,'product_id',oi.product_id,'product_name',oi.product_name,
          'emoji',oi.product_emoji,'quantity',oi.quantity,'returned_qty',oi.returned_qty,
          'rate_per_day',oi.rate_per_day,'days',oi.days,'subtotal',oi.subtotal
        )) FILTER (WHERE oi.id IS NOT NULL) AS items,
        json_agg(json_build_object(
          'id',di.id,'name',di.name,'quantity',di.quantity,
          'cost_each',di.cost_each,'total_cost',di.total_cost
        )) FILTER (WHERE di.id IS NOT NULL) AS damages
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id=o.id
      LEFT JOIN damage_items di ON di.order_id=o.id
      WHERE o.id=$1 AND o.store_id=$2
      GROUP BY o.id
    `, [req.params.id, req.storeId]);
    if (!r.rows[0]) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, order:r.rows[0] });
  } catch(e) { res.status(500).json({ success:false, message:'Failed' }); }
});

// ── CREATE ────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { customerName, customerPhone, eventType, eventAddress,
          fromDate, toDate, isVip, customDiscount, items,
          paidAmount, advanceAmount, notes } = req.body;

  if (!customerName || !fromDate || !items?.length)
    return res.status(400).json({ success:false, message:'Customer name, date, items required' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // stock check
    for (const item of items) {
      const s = await client.query(`
        SELECT total_qty,
          total_qty - COALESCE((
            SELECT SUM(oi.quantity - COALESCE(oi.returned_qty,0))
            FROM order_items oi JOIN orders o ON oi.order_id=o.id
            WHERE oi.product_id=$1 AND o.store_id=$4
              AND o.status IN ('active','partial')
              AND ($2::date, COALESCE($3::date, $2::date + interval '30 days'))
                  OVERLAPS (o.from_date, COALESCE(o.to_date, o.from_date + interval '30 days'))
          ),0) AS available
        FROM products WHERE id=$1 AND store_id=$4 AND is_active=true
      `, [item.product_id, fromDate, toDate||fromDate, req.storeId]);
      if (!s.rows[0]) throw new Error(`Product not found: ${item.product_name}`);
      if (s.rows[0].available < item.quantity)
        throw new Error(`Only ${s.rows[0].available} available for ${item.product_name}`);
    }

    const { days, subtotal, vip, disc, total } =
      calcItemsBill(items, fromDate, toDate||fromDate, isVip, customDiscount, 0);

    const advance    = parseFloat(advanceAmount) || 0;
    const paid       = advance > 0 ? advance : (parseFloat(paidAmount) || 0);
    const refund     = total > 0 && advance > total ? advance - total : 0;
    const balance    = refund > 0 ? 0 : Math.max(0, total - paid);
    const orderNo    = await generateOrderNumber(req.storeId);

    // upsert customer
    let custId = null;
    if (customerPhone) {
      const ec = await client.query(
        'SELECT id FROM customers WHERE store_id=$1 AND phone=$2', [req.storeId, customerPhone]);
      if (ec.rows[0]) {
        custId = ec.rows[0].id;
        await client.query('UPDATE customers SET name=$1 WHERE id=$2', [customerName, custId]);
      } else {
        const nc = await client.query(
          'INSERT INTO customers(store_id,name,phone,is_vip) VALUES($1,$2,$3,$4) RETURNING id',
          [req.storeId, customerName, customerPhone, isVip||false]);
        custId = nc.rows[0]?.id;
      }
    }

    const o = await client.query(`
      INSERT INTO orders(
        store_id,order_number,customer_id,customer_name,customer_phone,
        event_type,event_address,from_date,to_date,is_vip,
        subtotal,vip_discount,custom_discount,damage_charges,total_amount,
        advance_amount,paid_amount,balance_amount,return_amount,is_paid,
        notes,status,pending_bill_amount,pending_paid_amount,pending_settled,pending_covered
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17,$18,$19,$20,$21,0,0,FALSE,FALSE)
      RETURNING *
    `, [
      req.storeId, orderNo, custId, customerName, customerPhone||null,
      eventType||null, eventAddress||null, fromDate, toDate||null, isVip||false,
      subtotal, vip, disc, total,
      advance, paid, balance, refund, balance<=0, notes||null, 'active',
    ]);

    for (const item of items) {
      const sub = item.quantity * parseFloat(item.rate_per_day) * days;
      await client.query(
        'INSERT INTO order_items(order_id,product_id,product_name,product_emoji,quantity,returned_qty,rate_per_day,days,subtotal) VALUES($1,$2,$3,$4,$5,0,$6,$7,$8)',
        [o.rows[0].id, item.product_id, item.product_name, item.emoji||'📦', item.quantity, item.rate_per_day, days, sub]
      );
    }

    if (custId) {
      await client.query(
        'UPDATE customers SET total_orders=total_orders+1, total_revenue=total_revenue+$1, total_pending=total_pending+$2 WHERE id=$3',
        [total, balance, custId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success:true, order:{ ...o.rows[0], order_number:orderNo } });
  } catch(e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(400).json({ success:false, message:e.message||'Failed' });
  } finally { client.release(); }
});

// ── UPDATE ────────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const ex = await client.query(
      'SELECT * FROM orders WHERE id=$1 AND store_id=$2', [req.params.id, req.storeId]);
    if (!ex.rows[0]) throw new Error('Order not found');
    const e = ex.rows[0];

    // ── Pull fields (fallback to existing) ──
    const fromDate        = req.body.fromDate        ?? e.from_date;
    const toDate          = req.body.toDate          ?? e.to_date;
    const returnDate      = req.body.returnDate      !== undefined ? req.body.returnDate      : e.return_date;
    const isVip           = req.body.isVip           !== undefined ? req.body.isVip           : e.is_vip;
    const customDiscount  = req.body.customDiscount  !== undefined ? req.body.customDiscount  : e.custom_discount;
    const notes           = req.body.notes           ?? e.notes;
    const customerName    = req.body.customerName    ?? e.customer_name;
    const customerPhone   = req.body.customerPhone   ?? e.customer_phone;
    const eventType       = req.body.eventType       ?? e.event_type;
    const eventAddress    = req.body.eventAddress    ?? e.event_address;
    const advanceAmount   = req.body.advanceAmount   !== undefined ? parseFloat(req.body.advanceAmount)  : parseFloat(e.advance_amount||0);
    const paidAmountIn    = req.body.paidAmount       !== undefined ? parseFloat(req.body.paidAmount)     : parseFloat(e.paid_amount||0);

    // Stage B fields
    const pendingRetDate  = req.body.pendingReturnDate !== undefined ? req.body.pendingReturnDate : e.pending_return_date;
    const pendingCovered  = req.body.pendingCovered    !== undefined ? req.body.pendingCovered    : e.pending_covered;
    const pendingSettled  = req.body.pendingSettled    !== undefined ? req.body.pendingSettled    : e.pending_settled;
    const pendingPaidIn   = req.body.pendingPaidAmount !== undefined ? parseFloat(req.body.pendingPaidAmount) : parseFloat(e.pending_paid_amount||0);

    // ── Update item returned_qty if provided ──
    if (req.body.itemReturns?.length) {
      for (const ir of req.body.itemReturns) {
        await client.query(
          `UPDATE order_items
           SET returned_qty=$1, is_returned=($1 >= quantity), updated_at=NOW()
           WHERE id=$2 AND order_id=$3`,
          [ir.returned_qty, ir.id, req.params.id]
        ).catch(() => {
          // fallback if updated_at doesn't exist
          return client.query(
            'UPDATE order_items SET returned_qty=$1, is_returned=($1 >= quantity) WHERE id=$2 AND order_id=$3',
            [ir.returned_qty, ir.id, req.params.id]
          );
        });
      }
    }

    // ── Re-fetch items after update ──
    const itemsR  = await client.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
    const dmgR    = await client.query('SELECT COALESCE(SUM(total_cost),0) as total FROM damage_items WHERE order_id=$1', [req.params.id]);
    const dmgTotal = parseFloat(dmgR.rows[0].total) || 0;
    const allItems = itemsR.rows;

    // ── STAGE A: bill ALL items × returnDate ──
    const billEndDate = returnDate || toDate || null;
    let stageATotal = parseFloat(e.total_amount || 0);
    let stageASubtotal = parseFloat(e.subtotal || 0);
    let stageAVip = parseFloat(e.vip_discount || 0);
    let stageADisc = parseFloat(customDiscount || 0);
    let stageADays = 1;

    if (billEndDate) {
      const b = calcItemsBill(allItems, fromDate, billEndDate, isVip, customDiscount, dmgTotal);
      stageATotal    = b.total;
      stageASubtotal = b.subtotal;
      stageAVip      = b.vip;
      stageADisc     = b.disc;
      stageADays     = b.days;
    }

    // ── STAGE B: ONLY pending items × (returnDate → pendingRetDate) ──
    // Pending items = those where returned_qty < quantity (after itemReturns update)
    let stageBTotal = parseFloat(e.pending_bill_amount || 0);

    if (pendingRetDate && returnDate) {
      const pendingItemRows = allItems.filter(i =>
        (i.quantity || 0) > (i.returned_qty || 0)
      );
      if (pendingItemRows.length > 0) {
        // Use pending qty (not full quantity) for extra bill
        const pendCalcItems = pendingItemRows.map(i => ({
          ...i,
          quantity: i.quantity - (i.returned_qty || 0),
          qty:      i.quantity - (i.returned_qty || 0),
        }));
        const b = calcItemsBill(pendCalcItems, returnDate, pendingRetDate, false, 0, 0);
        stageBTotal = b.total;
      } else {
        stageBTotal = 0;
      }
    }

    // ── Grand total depends on pendingCovered ──
    // Stage A = ALL items bill (always)
    // Stage B extra = ONLY if not covered
    const extraCharge  = pendingCovered ? 0 : stageBTotal;
    const grandTotal   = stageATotal + extraCharge;

    // ── Payment ──
    const effPaidA   = Math.max(paidAmountIn, advanceAmount);
    const refund     = stageATotal > 0 && advanceAmount > stageATotal ? advanceAmount - stageATotal : 0;
    const pendingPaid = pendingSettled ? pendingPaidIn : 0;
    const totalPaid   = effPaidA + pendingPaid;
    const balance     = refund > 0 ? 0 : Math.max(0, grandTotal - totalPaid);
    const isPaid      = balance <= 0 && !!returnDate;

    // ── Status ──
    const allItemsReturned = allItems.every(i => (i.returned_qty||0) >= (i.quantity||0));
    let status = e.status;
    if (req.body.status) {
      status = req.body.status;
    } else if (returnDate && allItemsReturned && (pendingSettled || !hasPendingItems(allItems))) {
      status = isPaid ? 'returned' : 'partial';
    } else if (returnDate) {
      status = 'partial';
    }

    function hasPendingItems(items) {
      return items.some(i => (i.quantity||0) > (i.returned_qty||0));
    }

    await client.query(`
      UPDATE orders SET
        customer_name=$1, customer_phone=$2, event_type=$3, event_address=$4,
        from_date=$5, to_date=$6, return_date=$7, is_vip=$8, custom_discount=$9,
        subtotal=$10, vip_discount=$11, damage_charges=$12,
        total_amount=$13,
        advance_amount=$14, paid_amount=$15, balance_amount=$16, return_amount=$17,
        is_paid=$18, notes=$19, status=$20,
        pending_return_date=$21, pending_bill_amount=$22,
        pending_paid_amount=$23, pending_settled=$24, pending_covered=$25,
        updated_at=NOW()
      WHERE id=$26 AND store_id=$27
    `, [
      customerName, customerPhone, eventType, eventAddress,
      fromDate, toDate, returnDate||null, isVip, parseFloat(customDiscount)||0,
      stageASubtotal, stageAVip, dmgTotal,
      grandTotal,
      advanceAmount, effPaidA, balance, refund,
      isPaid, notes, status,
      pendingRetDate||null, stageBTotal,
      pendingPaid, pendingSettled, pendingCovered,
      req.params.id, req.storeId,
    ]);

    // ── Sync customer stats ──
    if (e.customer_id) {
      await client.query(`
        UPDATE customers SET
          total_revenue=(SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE customer_id=$1 AND store_id=$2),
          total_pending=(SELECT COALESCE(SUM(balance_amount),0) FROM orders WHERE customer_id=$1 AND store_id=$2 AND balance_amount>0),
          total_orders=(SELECT COUNT(*) FROM orders WHERE customer_id=$1 AND store_id=$2)
        WHERE id=$1
      `, [e.customer_id, req.storeId]).catch(()=>{});
    }

    await client.query('COMMIT');

    // Return fresh order
    const fresh = await db.query(`
      SELECT o.*,
        (SELECT COUNT(*) FROM order_items oi2
         WHERE oi2.order_id=o.id AND oi2.quantity > COALESCE(oi2.returned_qty,0)
        ) AS pending_items_count,
        json_agg(json_build_object(
          'id',oi.id,'product_name',oi.product_name,'emoji',oi.product_emoji,
          'quantity',oi.quantity,'returned_qty',oi.returned_qty,
          'rate_per_day',oi.rate_per_day,'days',oi.days,'subtotal',oi.subtotal
        )) FILTER (WHERE oi.id IS NOT NULL) AS items,
        json_agg(json_build_object(
          'id',di.id,'name',di.name,'quantity',di.quantity,
          'cost_each',di.cost_each,'total_cost',di.total_cost
        )) FILTER (WHERE di.id IS NOT NULL) AS damages
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id=o.id
      LEFT JOIN damage_items di ON di.order_id=o.id
      WHERE o.id=$1 GROUP BY o.id
    `, [req.params.id]);

    res.json({ success:true, order:fresh.rows[0] });
  } catch(e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(400).json({ success:false, message:e.message||'Failed' });
  } finally { client.release(); }
});

// ── ADD DAMAGE ────────────────────────────────────────────────────
router.post('/:id/damage', auth, async (req, res) => {
  const { name, quantity, costEach } = req.body;
  if (!name || !costEach) return res.status(400).json({ success:false, message:'Name and cost required' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const qty       = parseInt(quantity) || 1;
    const cost      = parseFloat(costEach);
    const total     = qty * cost;
    const dmgResult = await client.query(
      'INSERT INTO damage_items(order_id,name,quantity,cost_each,total_cost) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, name, qty, cost, total]
    );
    // Recalculate order total with new damage
    const o     = await client.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    const order = o.rows[0];
    if (!order) throw new Error('Order not found');
    const dmgSum = await client.query('SELECT COALESCE(SUM(total_cost),0) as t FROM damage_items WHERE order_id=$1', [req.params.id]);
    const dmg    = parseFloat(dmgSum.rows[0].t);
    const newStageA = Math.max(0,
      parseFloat(order.subtotal) - parseFloat(order.vip_discount) - parseFloat(order.custom_discount)
    ) + dmg;
    const extra       = order.pending_covered ? 0 : parseFloat(order.pending_bill_amount||0);
    const newGrand    = newStageA + extra;
    const effPaid     = Math.max(parseFloat(order.paid_amount||0), parseFloat(order.advance_amount||0));
    const refund      = parseFloat(order.advance_amount||0) > newStageA && newStageA > 0
      ? parseFloat(order.advance_amount) - newStageA : 0;
    const newBalance  = refund > 0 ? 0 : Math.max(0, newGrand - effPaid - parseFloat(order.pending_paid_amount||0));

    await client.query(
      'UPDATE orders SET damage_charges=$1, total_amount=$2, balance_amount=$3, return_amount=$4, is_paid=$5, updated_at=NOW() WHERE id=$6',
      [dmg, newGrand, newBalance, refund, newBalance<=0, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success:true, damage:dmgResult.rows[0] });
  } catch(e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ success:false, message:'Failed' });
  } finally { client.release(); }
});

// ── DELETE DAMAGE ─────────────────────────────────────────────────
router.delete('/:id/damage/:dmgId', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM damage_items WHERE id=$1 AND order_id=$2', [req.params.dmgId, req.params.id]);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ success:false }); }
});

// ── DELETE ORDER ──────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE id=$1 AND store_id=$2', [req.params.id, req.storeId]);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ success:false, message:'Failed' }); }
});

module.exports = router;
