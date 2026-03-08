# QA Checklist — Send & Export Flow (Phase 15A/15B)

Manual testing checklist for iPhone/iPad. Run after building with `npx expo run:ios`.

---

## Setup

- [ ] `npx expo install expo-print expo-sharing` complete and no build errors
- [ ] Business profile filled in: name, phone, email, address, website, terms
- [ ] At least one estimate with customer name, email, phone, address

---

## 1. Estimate PDF Export

### From EstimateDetailScreen
- [ ] Tap **Export PDF** → spinner shows briefly → native share sheet appears
- [ ] PDF file is named something identifiable (e.g. `estimate_EST-0001.pdf`)
- [ ] Open PDF: business header shows correct name, phone, email, address
- [ ] "Prepared For" block shows correct customer name, address, phone, email
- [ ] Line items table lists all non-disabled drivers with min–max range
- [ ] Materials table appears only when materials are present
- [ ] Price range total at bottom matches screen value (includes materials)
- [ ] Disclaimer text appears if set on estimate
- [ ] Terms footer appears if set in business profile
- [ ] Empty fields are omitted (no blank lines for missing phone/email)

### Long content
- [ ] Estimate with 10+ drivers: all fit in table without overflow
- [ ] Very long customer address wraps gracefully

---

## 2. Invoice PDF Export

### From InvoiceScreen
- [ ] Tap **Export PDF** → share sheet appears
- [ ] PDF header: business name, invoice number, issue date, status badge
- [ ] Reference `Ref: EST-XXXX` line appears if invoice was created from an estimate
- [ ] "Bill To" block: correct customer details
- [ ] Line items: all driver rows present with correct qty × unit price
- [ ] Materials appear as separate line items (labeled by material name)
- [ ] Subtotal, tax, total are correct
- [ ] **Balance Due** row appears for unpaid/sent invoices (critical)
- [ ] Balance Due is absent for paid/void invoices
- [ ] Payment history table appears when payments have been recorded
- [ ] Notes section appears only when invoice has notes
- [ ] Terms footer uses business profile terms

### Edge cases
- [ ] Invoice with no line items: totals show $0 without crashing
- [ ] Invoice with discount: discount line shown, total reduced correctly
- [ ] Overdue invoice: Balance Due label appears in red

---

## 3. Send via Email (MailComposer)

### From EstimateDetailScreen → Send Estimate
- [ ] Tap **Send Estimate** → spinner shows while PDF generates
- [ ] CommReviewModal opens with subject and body pre-filled
- [ ] "📎 PDF attached" badge shows in modal when PDF ready
- [ ] Tap **📎 Send via Email** → iOS Mail app opens with:
  - [ ] Recipient pre-filled (if customer has email)
  - [ ] Subject pre-filled from template
  - [ ] Body pre-filled from template
  - [ ] PDF file attached
- [ ] After sending, modal closes and timeline event logged (`estimate_sent`)
- [ ] `estimate.followUpStatus` updated to `quote_sent`

### When customer has no email
- [ ] "No email on file — you can enter one when sending" hint shows under Send Estimate
- [ ] CommReviewModal recipient field is blank (user can type one)

### From InvoiceScreen → Send Invoice
- [ ] Tap **Send Invoice** → modal opens with invoice template
- [ ] Invoice vars populated: invoice_number, invoice_total, balance_due, payment_terms
- [ ] Send → invoice status changes from `draft` to `sent`
- [ ] Timeline event: `invoice_sent`

---

## 4. Share via Share Sheet

### From ReviewSendScreen (legacy flow)
- [ ] Screen loads immediately; "Generating PDF…" badge shows while PDF builds
- [ ] "📎 PDF ready" badge (green) shows when done
- [ ] Send button label: **📎 Send with PDF**
- [ ] Share button label: **📄 Share PDF**
- [ ] Tap **Share PDF** → system share sheet with PDF file
- [ ] Double-tapping Share does not log duplicate timeline events (send-lock active)

### From CommReviewModal
- [ ] **Share PDF** button: opens expo-sharing for PDF file
- [ ] **Share** button without PDF: opens native Share.share with text

---

## 5. Copy to Clipboard

### From CommReviewModal
- [ ] Tap **Copy** → toast/confirmation shown
- [ ] Clipboard contains `Subject\n\nBody` text
- [ ] Paste works in Notes app

---

## 6. Attachment Presence / Fallback

- [ ] When `expo-print` installed: PDF generates and attaches
- [ ] Simulate missing expo-print (rename module): amber badge "PDF not available" shown, estimate text sent instead
- [ ] CommReviewModal without attachment: Share button says "📤 Share" not "📎 Share PDF"

---

## 7. Business Profile Propagation

- [ ] Change business name in Settings → re-export PDF → new name appears
- [ ] Remove business phone → PDF omits phone line (no blank row)
- [ ] Add terms & conditions text → appears in PDF footer

---

## 8. Totals Accuracy

- [ ] Create estimate with known drivers → PDF total matches EstimateDetailScreen
- [ ] Add materials → PDF materials table shows correct unit cost × qty = total
- [ ] Create invoice → line items match estimate drivers + materials
- [ ] Record partial payment → Balance Due = Total − Paid

---

## 9. Invoice Created from Estimate

- [ ] Create estimate `EST-0042`, then **Create Invoice**
- [ ] Invoice screen header shows: `Ref: EST-0042`
- [ ] Invoice PDF header-right shows: `Ref: EST-0042`
- [ ] Invoice line items include both driver rows AND material rows from estimate

---

## 10. Driver Explanations (Expand/Collapse)

- [ ] EstimateDetailScreen: driver rows without explanation — not tappable (no chevron)
- [ ] Driver rows with explanation — show ▼ chevron
- [ ] Tap row → explanation text expands below label, chevron flips to ▲
- [ ] Tap again → collapses
- [ ] Multiple rows can be expanded simultaneously

---

## 11. Follow-Up / Payment Reminder

- [ ] **Follow Up** button in EstimateDetailScreen → CommReviewModal with follow_up template
- [ ] Send → timeline logs `followup_sent`
- [ ] **Send Payment Reminder** in InvoiceScreen → modal with payment_reminder template
- [ ] Send → timeline logs `payment_reminder_sent`

---

## Pass Criteria

All items marked ✅ before submitting to pilot customer (Natural Origins Roofing).
