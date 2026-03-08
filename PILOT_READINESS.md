# EstimateOS — Pilot Readiness Checklist

Internal reference for Natural Origins Roofing pilot deployment.

---

## What is ready for pilot use

| Feature | Status | Notes |
|---------|--------|-------|
| Onboarding (business profile, vertical, numbering) | Ready | 3-step wizard, roofing vertical active |
| Lead/intake capture | Ready | 3-step form: contact, job details, notes + referral |
| Customer management | Ready | Add, edit, search, follow-up status, tags, preferred contact |
| Estimate creation | Ready | Full pricing engine, intake questions, price range computation |
| Estimate review & send | Ready | Email compose via MailComposer or Share sheet |
| Invoice creation + partial payments | Ready | Create from estimate, record payments, track balance |
| Follow-up workflow | Ready | Status pipeline, reminders, next-action scheduling |
| Communication templates | Ready | 5 default templates, merge fields, preview |
| Operations dashboard | Ready | Pipeline, stats, needs-attention, getting-started checklist |
| Pricing rules | Ready | 6 rule types, custom rule builder |
| Materials library | Ready | Add materials, link to estimates |
| AI site analysis | Demo only | DemoModal active, no live AI provider |
| Getting-started checklist | Ready | Persistent, dismissible, tracks pilot milestones |
| Test data tools | Ready | Seed sample data + clear all data in Settings |

---

## What is still in demo/stub mode

| Feature | Current behavior | What's needed for live |
|---------|-----------------|----------------------|
| AI analysis (Gemini) | Shows demo results, no credits deducted | Wire `aiProvider.callProvider()`, set Gemini API key |
| Online payments (Stripe) | Shows "setup required", manual recording works | Wire `paymentProvider.initiateCheckout()`, set Stripe keys |
| Google Maps | Graceful fallback, no map data | Wire `mapsProvider.searchPlaces()`, set Maps API key |
| Email send (SendGrid) | Uses device MailComposer / Share only | Wire `commProvider.sendEmail()` with SendGrid |
| SMS send (Twilio) | Opens native messaging app | Wire `commProvider.sendSms()` with Twilio |
| App subscription / IAP | Free tier defaults | Wire `appMonetization.getSubscriptionStatus()` with RevenueCat |
| Push notifications | Not available | Add FCM/APNs in `commProvider` |

---

## What should be tested manually before broader use

### Critical paths
- [ ] Create a lead via Intake → convert to Customer → create Estimate → create Invoice → record payment
- [ ] Edit an estimate after creation (re-open, change answers, verify price updates)
- [ ] Send an estimate via Review & Send (verify email compose opens)
- [ ] Create an invoice from an accepted estimate (verify line items transfer)
- [ ] Record a partial payment on an invoice (verify balance tracker updates)
- [ ] Schedule a follow-up reminder and verify it appears in Needs Attention
- [ ] Change customer follow-up status through the pipeline

### Edge cases
- [ ] Create an estimate with no customer name (should block on "Calculate Range")
- [ ] Try to record a payment larger than the remaining balance (should show error)
- [ ] Delete a customer and verify linked estimates/invoices are not deleted
- [ ] Void an invoice and verify it cannot receive further payments
- [ ] Seed sample data, verify it appears correctly, then clear all data

### Settings & onboarding
- [ ] Complete onboarding from fresh install
- [ ] Verify business profile persists after save
- [ ] Change estimate/invoice prefix and verify next number generates correctly
- [ ] Toggle AI features and verify they enable/disable correctly

---

## What should wait until live integrations

1. **Real AI analysis** — do not test with real customer photos until Gemini is connected and credit billing works
2. **Online payment collection** — do not promise customers online payment until Stripe is live
3. **Automated email/SMS** — do not enable silent send until SendGrid/Twilio are connected
4. **App Store billing** — do not activate subscription tiers until RevenueCat is wired

---

## Pilot workflow (suggested)

1. **Day 1**: Complete onboarding, set business profile, review pricing rules
2. **Day 1**: Use "Seed Sample Data" to explore the app with realistic records
3. **Day 2**: Capture a real lead via Intake, create a real estimate
4. **Day 2**: Review and send the estimate to the customer
5. **Day 3**: Follow up using the dashboard, schedule reminders
6. **Week 1**: Create first invoice for an accepted job, record first payment
7. **Week 1**: Review the dashboard for pipeline accuracy and "Needs Attention" relevance
8. **Week 2**: Clear sample data when confident, continue with real data only

---

## Known limitations

- AI analysis is demo-only (Phase 0) — no real image understanding
- No PDF export for estimates or invoices (uses email body text)
- Video understanding is stubbed (coming-soon badge)
- No multi-user / team features yet (single operator per account)
- Metrics on dashboard are best-effort approximations based on app activity
- Firebase offline persistence handles most offline scenarios, but extended offline use has not been stress-tested
