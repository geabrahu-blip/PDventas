"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmQRPayment = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
admin.initializeApp();
const db = admin.firestore();
// Use process.env for secure token storage in production, with a fallback for local testing
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'SUPER_SECRET_TOKEN_123';
exports.confirmQRPayment = functions.https.onRequest(async (req, res) => {
    // 1. Validate Secret Header
    const clientSecret = req.header('x-webhook-secret');
    if (!process.env.WEBHOOK_SECRET) {
        console.warn("WEBHOOK_SECRET environment variable is not set. Using insecure fallback.");
    }
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
            var _a;
            // Double check in transaction to avoid race conditions
            const orderRef = matchedOrderDoc.ref;
            const orderSnap = await t.get(orderRef);
            if (!orderSnap.exists) {
                throw new Error('Order disappeared');
            }
            if (((_a = orderSnap.data()) === null || _a === void 0 ? void 0 : _a.status) !== 'PENDING_QR') {
                throw new Error('Order already processed');
            }
            t.update(orderRef, {
                status: 'PAID',
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                webhookIdempotencyKey: idempotencyKey
            });
        });
        res.status(200).send('Payment matched and order updated');
    }
    catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});
//# sourceMappingURL=index.js.map