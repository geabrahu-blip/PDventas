import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();

// Secret to be set in environment config, or hardcoded for phase 1 demo if preferred.
// Normally: functions.config().webhook.secret
const WEBHOOK_SECRET = 'SUPER_SECRET_TOKEN_123'; // Replace with a secure token

export const confirmQRPayment = functions.https.onRequest(async (req, res) => {
  // 1. Validate Secret Header
  const clientSecret = req.header('x-webhook-secret');
  if (clientSecret !== WEBHOOK_SECRET) {
    res.status(401).send('Unauthorized');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { amount, raw_text } = req.body;

    if (amount === undefined || !raw_text) {
      res.status(400).send('Bad Request: Missing amount or raw_text');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      res.status(400).send('Bad Request: Invalid amount');
      return;
    }

    // 2. Idempotency Check
    // Create an approximate timestamp (e.g., minute precision) to avoid missing duplicates that arrive seconds apart
    const now = new Date();
    const approxTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()).toISOString();

    const hashInput = `${raw_text}_${approxTimestamp}`;
    const idempotencyKey = crypto.createHash('sha256').update(hashInput).digest('hex');

    const webhookRef = db.collection('processed_webhooks').doc(idempotencyKey);

    // We use a transaction to ensure no race conditions on idempotency check
    const isDuplicate = await db.runTransaction(async (t) => {
      const doc = await t.get(webhookRef);
      if (doc.exists) {
        return true;
      }
      // If it doesn't exist, we reserve this key immediately
      t.set(webhookRef, {
        raw_text,
        amount: parsedAmount,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return false;
    });

    if (isDuplicate) {
      res.status(200).send('Duplicate ignored');
      return;
    }

    // 3. FIFO Matching Logic
    // Search for the oldest pending order within the last 5 minutes with the exact amount
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const salesRef = db.collection('sales');
    // We assume 'sales' collection has status: 'PENDING_QR', 'date' (ISO string), and 'total' (number)
    // and potentially 'paymentMethod' == 'QR'
    const q = salesRef
      .where('status', '==', 'PENDING_QR')
      .where('total', '==', parsedAmount)
      .where('date', '>=', fiveMinutesAgo)
      .orderBy('date', 'asc')
      .limit(1);

    const snapshot = await q.get();

    if (snapshot.empty) {
      // 4. No Match - Save to unmatched_payments
      await db.collection('unmatched_payments').add({
        amount: parsedAmount,
        raw_text,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        reason: 'No pending order found matching amount and timeframe'
      });
      res.status(200).send('Payment logged as unmatched');
      return;
    }

    // 5. Match Found - Update status
    const matchedOrderDoc = snapshot.docs[0];

    await db.runTransaction(async (t) => {
      // Double check in transaction to avoid race conditions
      const orderRef = matchedOrderDoc.ref;
      const orderSnap = await t.get(orderRef);

      if (!orderSnap.exists) {
          throw new Error('Order disappeared');
      }

      if (orderSnap.data()?.status !== 'PENDING_QR') {
          throw new Error('Order already processed');
      }

      t.update(orderRef, {
        status: 'PAID',
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        webhookIdempotencyKey: idempotencyKey
      });
    });

    res.status(200).send('Payment matched and order updated');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});
