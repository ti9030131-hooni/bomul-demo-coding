import { paymentStatus } from '../services/payments.js';

export function getPaymentStatus(req, res) {
  res.json(paymentStatus());
}
