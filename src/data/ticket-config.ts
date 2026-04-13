import type { TicketType, TicketPriority } from '@/types'

// ── Category options ────────────────────────────────────────────

export interface CategoryOption {
  name: string
  subCategories?: string[]
}

// ── Ticket-type field config ────────────────────────────────────

export interface TicketTypeFieldConfig {
  showPriority: boolean
  defaultPriority: TicketPriority
}

// ── Static data ─────────────────────────────────────────────────

export const TICKET_TYPES: TicketType[] = [
  'Closing Support',
  'IT Support',
  'Lending Support',
  'Marketing Support',
  'Payoff Request',
  'Product Desk (Non-Agency Products)',
  'Secondary Support',
]

export const DEPARTMENT_CATEGORIES: Record<string, CategoryOption[]> = {
  'Closing Support': [
    { name: 'Closing Exceptions' },
    { name: 'Escrow Adjustments' },
    { name: 'General Question' },
    { name: 'ICD Release', subCategories: ['Early Release', 'Early Balance'] },
    { name: 'Move Closing Date' },
    { name: 'POA Approval' },
    { name: 'Post Closing' },
  ],
  'IT Support': [
    { name: 'DynaSend Signature' },
    {
      name: 'Email Distribution List',
      subCategories: ['Create', 'Delete', 'Add Member', 'Remove Member', 'Issue'],
    },
    { name: 'Forward Email' },
    {
      name: 'Hardware Issue',
      subCategories: ['Laptop', 'Keyboard/Mouse', 'Webcam', 'Docking Station', 'Monitor'],
    },
    {
      name: 'Hardware Request',
      subCategories: ['Laptop', 'Keyboard/Mouse', 'Webcam', 'Docking Station', 'Monitor'],
    },
    { name: 'Install Software' },
    {
      name: 'Add Access',
      subCategories: [
        'Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert',
        'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic',
        'eFAX', 'FHA Connection', 'Halcyon', 'Intranet',
        'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA',
        'ValuTrac', 'Zoom',
      ],
    },
    { name: 'New Hire' },
    {
      name: 'Password Reset',
      subCategories: [
        'Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert',
        'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic',
        'eFAX', 'FHA Connection', 'Halcyon', 'Intranet',
        'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA',
        'ValuTrac', 'Zoom',
      ],
    },
    {
      name: 'Remove Access',
      subCategories: [
        'Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert',
        'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic',
        'eFAX', 'FHA Connection', 'Halcyon', 'Intranet',
        'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA',
        'ValuTrac', 'Zoom',
      ],
    },
    {
      name: 'Modify Access',
      subCategories: [
        'Bank VOD', 'CANDID', 'Certified Credit', 'CreditXpert',
        'DataVerify (DRIVE)', 'Desktop Underwriter (FNMA)', 'DocMagic',
        'eFAX', 'FHA Connection', 'Halcyon', 'Intranet',
        'MeridianLink Mortgage', 'Microsoft', 'Nitro', 'USDA', 'VA',
        'ValuTrac', 'Zoom',
      ],
    },
    { name: 'Shared Mailbox' },
    { name: 'Termination' },
    { name: 'Transfer / Title Change' },
    { name: 'Unblock Website' },
  ],
  'Lending Support': [
    { name: 'Condition Dispute' },
    { name: 'Condo Review' },
    { name: 'Exception Request' },
    { name: 'Funding Closing Issue' },
    { name: 'Income Opinion' },
    { name: 'Loan Status Change' },
    { name: 'Opinion General' },
    {
      name: 'Post Closing Audit',
      subCategories: ['Prior to Purchase', 'Post Purchase'],
    },
    { name: 'Pre-Approval Certified Buyer' },
    { name: 'PTS Condition Review' },
    { name: 'Trained Validation' },
  ],
  'Marketing Support': [
    { name: 'Communications' },
    { name: 'CRM' },
    { name: 'Graphic Design' },
    { name: 'Swag/Promo Items' },
    { name: 'Web' },
    { name: 'Other' },
  ],
  'Payoff Request': [
    { name: 'Mortgage Billing Statement' },
    { name: 'Payment History' },
    { name: 'SFMC Payoff', subCategories: ['Net Escrow', 'Traditional'] },
  ],
  'Product Desk (Non-Agency Products)': [
    { name: 'Bank Statement' },
    { name: 'DSCR' },
    { name: 'Not Certain' },
    { name: 'Other Product' },
  ],
  'Secondary Support': [
    { name: 'Bond Lock Request' },
    { name: 'Extension' },
    { name: 'Lender Credit' },
    {
      name: 'Loan Structure Revision',
      subCategories: ['Before CTC', 'After CTC'],
    },
    { name: 'PML/Quick Pricer' },
    { name: 'Post Closing Issue' },
    { name: 'Pricing Exception' },
    {
      name: 'Specialty Program Lock Request',
      subCategories: ['Buydown', 'Reverse', 'Wholesale'],
    },
    { name: 'Specialty Term Adjustment' },
  ],
}

export const DEFAULT_TICKET_TYPE_FIELD_CONFIGS: Record<string, TicketTypeFieldConfig> = {
  'Closing Support': { showPriority: true, defaultPriority: 'medium' },
  'IT Support': { showPriority: true, defaultPriority: 'medium' },
  'Lending Support': { showPriority: true, defaultPriority: 'medium' },
  'Marketing Support': { showPriority: false, defaultPriority: 'medium' },
  'Payoff Request': { showPriority: false, defaultPriority: 'medium' },
  'Product Desk (Non-Agency Products)': { showPriority: true, defaultPriority: 'medium' },
  'Secondary Support': { showPriority: true, defaultPriority: 'medium' },
}

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const
