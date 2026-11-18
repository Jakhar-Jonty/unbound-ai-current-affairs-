'use strict';
/**
 * Creates the monthly and yearly plans in your Razorpay account (run once per
 * account / mode) and prints the plan IDs to put in .env.
 *   RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... npm run razorpay:plans
 */
const Razorpay = require('razorpay');
const config = require('../src/config');

async function main() {
  const { keyId, keySecret } = config.razorpay;
  if (!keyId || !keySecret) throw new Error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first');
  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const lines = [];
  for (const [id, p] of Object.entries(config.premium.plans)) {
    const plan = await rzp.plans.create({
      period: p.period,
      interval: 1,
      item: { name: `Premium – ${p.label}`, amount: p.amount, currency: 'INR', description: `Unbound Daily Premium (${p.label.toLowerCase()})` },
      notes: { app: 'unbound', plan: id },
    });
    lines.push(`RAZORPAY_PLAN_${id.toUpperCase()}=${plan.id}`);
  }
  console.log(`Plans created. Add these to .env:\n\n${lines.join('\n')}`);
}

main().catch((err) => { console.error(err.error?.description || err.message); process.exit(1); });
