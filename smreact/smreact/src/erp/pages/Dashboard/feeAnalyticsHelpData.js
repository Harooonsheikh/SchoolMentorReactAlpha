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
        ['Total students', '82'],
        ['Challans generated', '70'],
        ['Total generated fee', 'PKR 350,000'],
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
        ['Total students', '600'],
        ['Students with previous dues', '20'],
        ['Previous dues', 'PKR 100,000'],
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
        { label: 'Current Month Fee', value: 'PKR 500,000' },
        { op: '+' },
        { label: 'Previous Dues', value: 'PKR 100,000' },
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
    scope: 'What has actually been collected. A generated challan does not mean the fee has already been paid.',
    description:
      'Fee Received represents the fee that has actually been collected from students. The card shows the received amount and the number of students/challans for which payment has been received, plus collection progress against the applicable fee position.',
    dataPoints: [
      'Challans Paid: number of students/challans whose fee has been received',
      'Amount received: total fee actually collected so far',
      'Collection Progress: received amount as a percentage of the applicable fee position',
    ],
    example: {
      note: 'Example only (for illustration, not live data)',
      rows: [
        ['Total challans generated', '500'],
        ['Received', '400'],
        ['Amount received', 'PKR 400,000'],
      ],
    },
  },

  pending: {
    title: 'Pending Fee',
    icon: 'fa-hourglass-half',
    tone: 'red',
    scope: 'What is still outstanding after received payments are deducted from the total net receivable.',
    description:
      'Pending Fee shows the fee amount still outstanding after subtracting what has been received from the Total Net Receivable. The card also shows the number of students/challans whose payment is still unpaid.',
    dataPoints: [
      'Total Net Receivable: everything currently receivable (current month + previous dues)',
      'Fee Received: what has already been collected',
      'Pending Fee = Total Net Receivable − Fee Received',
      'Challans Pending: students/challans still unpaid, out of the total',
    ],
    formula: {
      parts: [
        { label: 'Total Net Receivable', value: 'PKR 600,000' },
        { op: '−' },
        { label: 'Fee Received', value: 'PKR 400,000' },
      ],
      result: { label: 'Pending Fee', value: 'PKR 200,000' },
      note: 'Example only (for illustration, not live data)',
    },
    showRelationship: true,
  },
};

/* Card → flow order, used to render the small "how the 5 cards relate"
   diagram inside the Total Net Receivable and Pending Fee modals. */
export const FEE_ANALYTICS_FLOW = [
  { key: 'currentMonth', label: 'Current Month Fee', op: '+' },
  { key: 'previousDues', label: 'Previous Dues', op: '↓' },
  { key: 'netReceivable', label: 'Total Net Receivable', op: '↓' },
  { key: 'received', label: 'Fee Received', op: '↓' },
  { key: 'pending', label: 'Pending Fee', op: null },
];
