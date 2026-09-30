/* ═══════════════════════════════════════════════════════════════════
   FEE ANALYTICS — "How is this calculated?" explanation content.

   Purely descriptive config consumed by FeeAnalyticsInfoModal. Nothing
   here is rendered on the live cards — the numbers below are labelled
   as an example and only exist to illustrate the calculation logic.
   ═══════════════════════════════════════════════════════════════════ */
export const feeAnalyticsHelpContent = {
  currentMonth: {
    title: 'Current Month Fee Position',
    icon: 'fa-money-check-dollar',
    tone: 'brand',
    scope: 'Current month only. Previous dues are not included in this card.',
    description:
      "Current Month Fee Position shows the fee challans generated for the current month. It tells you how many students have fee challans generated, the total amount of those generated challans, and any discount applied, before payment status is considered.",
    dataPoints: [
      'Total students considered for the current month',
      'Number of fee challans generated this month',
      'Total fee amount generated through those challans',
      'Discount Given: total discount applied on generated challans',
      'Challans Generated: challans issued out of total students',
    ],
    example: {
      note: 'Example only (for illustration, not live data)',
      rows: [
        ['Challans generated', '550 of 600'],
        ['Total generated fee', 'PKR 400,000'],
      ],
    },
  },

  previousDues: {
    title: 'Previous Dues',
    icon: 'fa-circle-exclamation',
    tone: 'red',
    scope: 'Carried forward from earlier months. Separate from the current month’s newly generated fee.',
    description:
      'Previous Dues represents outstanding fee amounts carried forward from earlier months. It shows the number of students with previous outstanding balances and the total amount still due from before this month.',
    dataPoints: [
      'Students with Dues: students who have unpaid balances from past months',
      'Total previous dues amount still outstanding',
      'Carried from past months: not part of this month’s generated challans',
    ],
    example: {
      note: 'Example only (for illustration, not live data)',
      rows: [
        ['Students with previous dues', '40'],
        ['Previous dues', 'PKR 200,000'],
      ],
    },
  },

  netReceivable: {
    title: 'Total Net Receivable',
    icon: 'fa-scale-balanced',
    tone: 'slate',
    scope: 'The total amount currently receivable by the school, not the amount already received.',
    description:
      'Total Net Receivable is the combined amount of the Current Month Fee Position and Previous Dues. It represents everything the school can currently collect from students, whether newly generated this month or carried forward from before.',
    dataPoints: [
      'Current Month Fee Position: this month’s generated fee',
      'Previous Dues: outstanding balance from earlier months',
      'Total Net Receivable = Current Month Fee + Previous Dues',
    ],
    formula: {
      parts: [
        { label: 'Current Month Fee', value: 'PKR 400,000' },
        { op: '+' },
        { label: 'Previous Dues', value: 'PKR 200,000' },
      ],
      result: { label: 'Total Net Receivable', value: 'PKR 600,000' },
      note: 'Example only (for illustration, not live data)',
    },
    showRelationship: true,
  },

  received: {
    title: 'Fee Received',
    icon: 'fa-circle-check',
    tone: 'green',
    scope: 'What has actually been collected against the Net Receivable, separate from any discount or advance.',
    description:
      'Fee Received represents the fee that has actually been collected from students against the current dues. It does not include any receiving-time discount (that reduces receivable separately) or any advance (that is extra money above what was payable). Those are tracked on their own cards.',
    dataPoints: [
      'Amount received: total fee actually collected against Net Receivable so far',
      'Collection %: received amount as a percentage of Net Receivable',
    ],
    example: {
      note: 'Example only (for illustration, not live data)',
      rows: [
        ['Net Receivable', 'PKR 600,000'],
        ['Amount received', 'PKR 200,000'],
      ],
    },
  },

  pending: {
    title: 'Pending Fee',
    icon: 'fa-hourglass-half',
    tone: 'red',
    scope: 'The final outcome card: what is still outstanding after received payments, receiving-time discount, and advance adjustments are deducted.',
    description:
      "Pending Fee shows the fee amount still outstanding after subtracting what has been received, any discount given during fee receiving, and any advance balance actually applied against this month's challan, from the Total Net Receivable. This is different from Advance Payments Received (Card 6), which is money collected above what was payable and carried forward — that balance is never subtracted here until it is actually applied against a challan, at which point it shows up as an Advance Adjustment.",
    dataPoints: [
      'Total Net Receivable: everything currently receivable (current month + previous dues)',
      'Fee Received: what has already been collected against dues',
      'Receiving Discount: extra discount given manually while receiving fee, reduces the receivable',
      "Advance Adjustments: a student's previous advance balance applied against this month's challan",
      'Pending Fee = Net Receivable − Fee Received − Receiving Discount − Advance Adjustments',
    ],
    formula: {
      parts: [
        { label: 'Net Receivable', value: 'PKR 1,509,275' },
        { op: '−' },
        { label: 'Fee Received', value: 'PKR 212,650' },
        { op: '−' },
        { label: 'Receiving Discount', value: 'PKR 18,000' },
        { op: '−' },
        { label: 'Advance Adjustments', value: 'PKR 20,000' },
      ],
      result: { label: 'Pending Fee', value: 'PKR 1,258,625' },
      note: 'Example only (for illustration, not live data).',
    },
    showRelationship: true,
  },

  discountGiven: {
    title: 'Discount Given During Receiving',
    icon: 'fa-tags',
    tone: 'amber',
    scope: 'Manual discount applied at the fee counter while receiving payment, separate from any discount already baked into the generated challan.',
    description:
      'Shows additional discounts provided manually during fee receiving. Discount reduces the outstanding receivable; it is subtracted directly in the Pending Fee formula. It is tracked per student, per fee head, at the moment a payment is received, not the discount approved earlier on the challan itself.',
    dataPoints: [
      'Total discount amount given at receiving time, across all payments',
      'Number of students who received a receiving-time discount',
      'Discount reduces outstanding receivable, unlike Advance, which does not',
      'Broken down by student, fee head, and the staff member who gave it',
    ],
    example: {
      note: 'Example only (for illustration, not live data)',
      rows: [
        ['Students given a discount', '14'],
        ['Total discount given', 'PKR 20,000'],
      ],
    },
  },

  advance: {
    title: 'Advance Payments Received',
    icon: 'fa-piggy-bank',
    tone: 'purple',
    scope: 'Extra money received and carried forward. Not the same as Discount, and NOT a reduction of current Pending Fee.',
    description:
      'Shows payments received above the current payable amount: extra amount received and carried forward. It does not reduce current pending dues. Instead it becomes a "Future Adjustment Balance": money already in hand that will be adjusted against a future month\'s challan once it is generated.',
    dataPoints: [
      'Total advance amount collected above the current payable amount',
      'Number of students who paid more than their current payable',
      'Advance does NOT reduce Pending Fee. It is shown separately as a Future Adjustment Balance',
      'Broken down by student, amount received, and payment method',
    ],
    example: {
      note: 'Example only (for illustration, not live data)',
      rows: [
        ['Students who paid in advance', '6'],
        ['Total advance received', 'PKR 30,000'],
      ],
    },
  },

  advanceAdjustments: {
    title: 'Advance Adjustments',
    icon: 'fa-arrow-right-arrow-left',
    tone: 'purple',
    scope: 'Previous advance balance actually applied against this month\'s challan. The opposite movement from Advance Payments Received (Card 6), and — unlike that card — DOES reduce Pending Fee.',
    description:
      'A student can build up an advance balance over time (Card 6) by paying more than what was payable. When a new challan is later generated for that student and their advance balance is applied against it, that consumption is recorded here as an Advance Adjustment — real money that already existed as credit, not a fresh cash collection, so it must never be counted inside Fee Received. It does, however, genuinely reduce what is still outstanding, so it is subtracted directly in the Pending Fee formula.',
    dataPoints: [
      "Total amount of previous advance balance applied against this month's challans",
      'Number of students whose advance balance was adjusted this month',
      'Sourced from the same advance ledger as the Advance Fee Adjustment Report in Fee → Reports',
      'Advance Adjustments reduces Pending Fee, but is never added to Fee Received',
    ],
    formula: {
      parts: [
        { label: 'Opening Advance Balance', value: 'PKR 20,000' },
        { op: '−' },
        { label: 'Applied to This Month\'s Challan', value: 'PKR 20,000' },
      ],
      result: { label: 'Remaining Advance Balance', value: 'PKR 0' },
      note: 'Example only (for illustration, not live data). The PKR 20,000 applied is what appears on this card, and is subtracted from Pending Fee.',
    },
  },
};

/* Card → flow order, used to render the small "how the cards relate"
   diagram inside the Total Net Receivable and Pending Fee modals.
   Discount/Advance are deliberately NOT in this chain — Discount feeds
   directly into the Pending Fee formula (see its own `formula` above)
   and Advance is an intentionally separate, parallel figure. */
export const FEE_ANALYTICS_FLOW = [
  { key: 'currentMonth', label: 'Current Month Fee', op: '+' },
  { key: 'previousDues', label: 'Previous Dues', op: '↓' },
  { key: 'netReceivable', label: 'Total Net Receivable', op: '↓' },
  { key: 'received', label: 'Fee Received', op: '↓' },
  { key: 'pending', label: 'Pending Fee', op: null },
];
