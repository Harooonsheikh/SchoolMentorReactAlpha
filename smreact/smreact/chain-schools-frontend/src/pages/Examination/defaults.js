/* ═══════════════════════════════════════════════════════════════════
   Result policy defaults. Copied from the School Mentor ERP mock data
   (src/mock/exams.js and src/mock/preschool.js) so a new chain policy
   starts with the same grade scale, remarks, learning areas, grading
   scale, SLO levels, PSD fields and card options a school starts with.

   Each final remark is paired with the grade band that has the same
   condition and percentage (e.g. 90% → A+). That pairing is a default
   only; the grade on every remark stays editable.

   Signatures are deliberately NOT here: they are named people and differ
   per school, so each school keeps its own (as in the ERP).
   ═══════════════════════════════════════════════════════════════════ */

export const PRESCHOOL_LEVELS = [
  {
    "id": "pg",
    "name": "Play Group / Pre 1"
  },
  {
    "id": "nur",
    "name": "Nursery / Pre 2"
  },
  {
    "id": "kg",
    "name": "KG / Pre 3"
  }
]

export const DEFAULT_GRADE_CONTENT = {
  absentMode: 'exclude',
  grades: [
  {
    "id": 1,
    "grade": "A+",
    "cond": "gte",
    "pct": "90",
    "comment": "Outstanding performance"
  },
  {
    "id": 2,
    "grade": "A",
    "cond": "gte",
    "pct": "80",
    "comment": "Very Good Work Done"
  },
  {
    "id": 3,
    "grade": "B",
    "cond": "gte",
    "pct": "70",
    "comment": "Good Work Done"
  },
  {
    "id": 4,
    "grade": "C",
    "cond": "gte",
    "pct": "60",
    "comment": "Satisfactory Work Done"
  },
  {
    "id": 5,
    "grade": "D",
    "cond": "gte",
    "pct": "50",
    "comment": "Needs Improvement"
  },
  {
    "id": 6,
    "grade": "F",
    "cond": "lt",
    "pct": "50",
    "comment": "Unsatisfactory"
  }
],
  remarks: [
  {
    "id": 1,
    "grade": "A+",
    "cond": "gte",
    "pct": "90",
    "text": "Outstanding performance. Demonstrates excellent understanding, consistency, and academic excellence. Keep up the exceptional work."
  },
  {
    "id": 2,
    "grade": "A",
    "cond": "gte",
    "pct": "80",
    "text": "Very Good Work Done. Keep Working Hard to Maintain Your Position. All the best for your future endeavors."
  },
  {
    "id": 3,
    "grade": "B",
    "cond": "gte",
    "pct": "70",
    "text": "Good performance. Concepts are mostly clear with steady effort. Continued practice will lead to further improvement."
  },
  {
    "id": 4,
    "grade": "C",
    "cond": "gte",
    "pct": "60",
    "text": "Satisfactory progress. Basic understanding is evident. Needs more consistency and focused effort to improve."
  },
  {
    "id": 5,
    "grade": "D",
    "cond": "gte",
    "pct": "50",
    "text": "Needs improvement. Minimum requirements met, but greater attention, practice, and revision are required."
  },
  {
    "id": 6,
    "grade": "F",
    "cond": "lt",
    "pct": "50",
    "text": "Below satisfactory level. Requires serious effort, regular practice, and academic support to meet learning standards."
  }
],
}

export const DEFAULT_PRESCHOOL_CONTENT = {
  learningAreas: [
  {
    "id": "la_1",
    "name": "English (Phonics & Language)",
    "icon": "fa-book-open"
  },
  {
    "id": "la_2",
    "name": "Urdu",
    "icon": "fa-language"
  },
  {
    "id": "la_3",
    "name": "Mathematics / Early Numeracy",
    "icon": "fa-calculator"
  },
  {
    "id": "la_4",
    "name": "Islamiyat / Ethics",
    "icon": "fa-mosque"
  },
  {
    "id": "la_5",
    "name": "General Knowledge",
    "icon": "fa-globe"
  },
  {
    "id": "la_6",
    "name": "The World Around Us",
    "icon": "fa-tree"
  },
  {
    "id": "la_7",
    "name": "Montessori Activities",
    "icon": "fa-puzzle-piece"
  },
  {
    "id": "la_8",
    "name": "Art, Craft & Creative Expression",
    "icon": "fa-palette"
  },
  {
    "id": "la_9",
    "name": "Physical Development",
    "icon": "fa-person-running"
  },
  {
    "id": "la_10",
    "name": "Personal & Social Development",
    "icon": "fa-people-arrows"
  }
],
  gradingScale: [
  {
    "code": "E",
    "label": "Exceeding Expectations",
    "color": "#16A34A",
    "range": "90% - 100%"
  },
  {
    "code": "M",
    "label": "Meeting Expectations",
    "color": "#1E40AF",
    "range": "75% - 89%"
  },
  {
    "code": "A",
    "label": "Approaching Expectations",
    "color": "#D97706",
    "range": "50% - 74%"
  },
  {
    "code": "NY",
    "label": "Not Yet Meeting Expectations",
    "color": "#DC2626",
    "range": "Below 50%"
  }
],
  slo: {
  "pg": {
    "la_1": [
      {
        "id": "slo_pg_1_1",
        "text": "Enjoys listening to rhymes and stories"
      },
      {
        "id": "slo_pg_1_2",
        "text": "Points to familiar pictures when named"
      }
    ],
    "la_2": [
      {
        "id": "slo_pg_2_1",
        "text": "Repeats simple Urdu words"
      }
    ],
    "la_3": [
      {
        "id": "slo_pg_3_1",
        "text": "Sorts objects by colour"
      },
      {
        "id": "slo_pg_3_2",
        "text": "Recognises big vs small"
      }
    ],
    "la_4": [
      {
        "id": "slo_pg_4_1",
        "text": "Says Bismillah before eating"
      }
    ],
    "la_5": [
      {
        "id": "slo_pg_5_1",
        "text": "Names immediate family members"
      }
    ],
    "la_6": [
      {
        "id": "slo_pg_6_1",
        "text": "Identifies familiar animals by picture"
      }
    ],
    "la_7": [
      {
        "id": "slo_pg_7_1",
        "text": "Explores practical life materials with guidance"
      }
    ],
    "la_8": [
      {
        "id": "slo_pg_8_1",
        "text": "Scribbles freely with crayons"
      }
    ],
    "la_9": [
      {
        "id": "slo_pg_9_1",
        "text": "Walks and runs with balance"
      }
    ],
    "la_10": [
      {
        "id": "slo_pg_10_1",
        "text": "Separates from parent without distress"
      }
    ]
  },
  "nur": {
    "la_1": [
      {
        "id": "slo_nur_1_1",
        "text": "Recognises a few letter sounds"
      },
      {
        "id": "slo_nur_1_2",
        "text": "Speaks in short phrases"
      }
    ],
    "la_2": [
      {
        "id": "slo_nur_2_1",
        "text": "Recognises a few Urdu alphabets"
      },
      {
        "id": "slo_nur_2_2",
        "text": "Repeats simple Urdu rhymes"
      }
    ],
    "la_3": [
      {
        "id": "slo_nur_3_1",
        "text": "Counts objects up to 10"
      },
      {
        "id": "slo_nur_3_2",
        "text": "Identifies basic shapes"
      }
    ],
    "la_4": [
      {
        "id": "slo_nur_4_1",
        "text": "Recites short Duas with guidance"
      }
    ],
    "la_5": [
      {
        "id": "slo_nur_5_1",
        "text": "Names common community helpers"
      }
    ],
    "la_6": [
      {
        "id": "slo_nur_6_1",
        "text": "Talks about the weather"
      }
    ],
    "la_7": [
      {
        "id": "slo_nur_7_1",
        "text": "Uses practical life materials with some independence"
      }
    ],
    "la_8": [
      {
        "id": "slo_nur_8_1",
        "text": "Uses colours to represent simple objects"
      }
    ],
    "la_9": [
      {
        "id": "slo_nur_9_1",
        "text": "Hops and jumps with control"
      }
    ],
    "la_10": [
      {
        "id": "slo_nur_10_1",
        "text": "Plays alongside other children"
      }
    ]
  },
  "kg": {
    "la_1": [
      {
        "id": "slo_1_1",
        "text": "Recognises letter sounds"
      },
      {
        "id": "slo_1_2",
        "text": "Speaks simple sentences"
      },
      {
        "id": "slo_1_3",
        "text": "Pre-writing skills (tracing, holding pencil correctly)"
      },
      {
        "id": "slo_1_4",
        "text": "Listens to and understands short stories"
      }
    ],
    "la_2": [
      {
        "id": "slo_2_1",
        "text": "Recognises basic Urdu alphabets"
      },
      {
        "id": "slo_2_2",
        "text": "Repeats simple Urdu words and rhymes"
      }
    ],
    "la_3": [
      {
        "id": "slo_3_1",
        "text": "Recognises and names numerals 1 to 20"
      },
      {
        "id": "slo_3_2",
        "text": "Counts objects with one-to-one correspondence"
      },
      {
        "id": "slo_3_3",
        "text": "Identifies basic shapes and colours"
      },
      {
        "id": "slo_3_4",
        "text": "Sorts and compares objects"
      }
    ],
    "la_4": [
      {
        "id": "slo_4_1",
        "text": "Recites short Surahs and Duas"
      },
      {
        "id": "slo_4_2",
        "text": "Shows awareness of good manners (adab)"
      }
    ],
    "la_5": [
      {
        "id": "slo_5_1",
        "text": "Names family members and their roles"
      },
      {
        "id": "slo_5_2",
        "text": "Identifies common community helpers"
      }
    ],
    "la_6": [
      {
        "id": "slo_6_1",
        "text": "Identifies common animals, plants and their habitats"
      },
      {
        "id": "slo_6_2",
        "text": "Observes and talks about the weather and seasons"
      }
    ],
    "la_7": [
      {
        "id": "slo_7_1",
        "text": "Uses practical life materials independently"
      },
      {
        "id": "slo_7_2",
        "text": "Completes sensorial activities with focus"
      }
    ],
    "la_8": [
      {
        "id": "slo_8_1",
        "text": "Uses colours and materials creatively"
      },
      {
        "id": "slo_8_2",
        "text": "Shows interest and participation in craft activities"
      }
    ],
    "la_9": [
      {
        "id": "slo_9_1",
        "text": "Demonstrates balance and coordination in movement"
      },
      {
        "id": "slo_9_2",
        "text": "Participates actively in outdoor/physical play"
      }
    ],
    "la_10": [
      {
        "id": "slo_10_1",
        "text": "Interacts positively with peers"
      },
      {
        "id": "slo_10_2",
        "text": "Follows classroom routines"
      }
    ]
  }
},
  psdFields: [
  {
    "id": "psd_1",
    "label": "Punctuality"
  },
  {
    "id": "psd_2",
    "label": "Discipline"
  },
  {
    "id": "psd_3",
    "label": "Classroom Behaviour"
  },
  {
    "id": "psd_4",
    "label": "Following Instructions"
  },
  {
    "id": "psd_5",
    "label": "Teamwork"
  },
  {
    "id": "psd_6",
    "label": "Confidence"
  },
  {
    "id": "psd_7",
    "label": "Independence"
  },
  {
    "id": "psd_8",
    "label": "Cleanliness"
  },
  {
    "id": "psd_9",
    "label": "Self Care"
  },
  {
    "id": "psd_10",
    "label": "Participation"
  }
],
  cardOptions: [
  {
    "label": "Show School Logo",
    "icon": "fa-school",
    "on": true
  },
  {
    "label": "Show Student Photo",
    "icon": "fa-user",
    "on": true
  },
  {
    "label": "Show Attendance Summary",
    "icon": "fa-calendar-check",
    "on": true
  },
  {
    "label": "Show Overall Performance Summary",
    "icon": "fa-chart-simple",
    "on": true
  },
  {
    "label": "Show Performance Chart",
    "icon": "fa-chart-pie",
    "on": true
  },
  {
    "label": "Show Subject-wise Assessment",
    "icon": "fa-book",
    "on": true
  },
  {
    "label": "Show Personal & Social Development",
    "icon": "fa-people-arrows",
    "on": true
  },
  {
    "label": "Show Teacher Observation Remarks",
    "icon": "fa-comment-dots",
    "on": true
  },
  {
    "label": "Show Parent Teacher Meeting Section",
    "icon": "fa-handshake",
    "on": true
  },
  {
    "label": "Show Promotion / Retention Status",
    "icon": "fa-arrow-up-right-from-square",
    "on": true
  }
],
}

/* Built into the School Mentor ERP code (not editable there): the three
   Preschool report templates and the final-remark text per achievement code.
   Shown read-only in the Chain policy so both systems read the same. */
export const PRESCHOOL_TEMPLATES = [
  { id: 'monthly', name: 'Preschool Monthly Assessment', desc: "One month's achievement snapshot per learning area.", icon: 'fa-calendar-day', accent: '#1E40AF' },
  { id: 'term', name: 'Preschool Term Report', desc: 'Achievement summary across the whole term.', icon: 'fa-calendar-week', accent: '#7C3AED' },
  { id: 'annual', name: 'Preschool Annual Report', desc: 'Full-year achievement & development overview.', icon: 'fa-calendar', accent: '#D97706' },
]

export const PRESCHOOL_FINAL_REMARKS = {
  E: 'Outstanding progress across most learning areas. Keep encouraging this enthusiasm at home.',
  M: 'Consistently meeting expectations. Continue building on this steady progress.',
  A: 'Approaching expectations — with a little more practice, will catch up quickly.',
  NY: 'Needs additional support and practice. Please work closely with the teacher.',
}
