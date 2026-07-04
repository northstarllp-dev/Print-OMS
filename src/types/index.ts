export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  city?: string;
  billingAddress: string;
  shippingAddress: string;
  status?: string;
  customerCode?: string;
  customerId?: string;
}

export interface Employee {
  id: string;
  employeeId?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  status?: string;
  rating?: number;
  workload?: number;
  jobsAssigned?: number;
}

export type PipelineStage =
  | "Site Visit Pending"
  | "Site Visit Scheduled"
  | "Site Visit Completed"
  | "Quotation In Progress"
  | "Quotation Sent"
  | "Quotation Negotiation"
  | "Quotation Approved"
  | "Design In Progress"
  | "Design Approved"
  | "Production"
  | "Ready For Installation"
  | "Installation Scheduled"
  | "Completed"
  | "Closed";

export interface VersionItem {
  version: string;
  date: string;
  notes: string;
  active?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  time: string;
  message: string;
  verified?: boolean;
}

// New Sign Location type
export interface SignLocation {
  id: string;
  name: string;
  width?: number;
  widthUnit?: string;
  height?: number;
  heightUnit?: string;
  depth?: number;
  depthUnit?: string;
  groundClearance?: number;
  groundClearanceUnit?: string;
  notes?: string;
  photos: string[];
  
  // Electrical Assessment
  powerAvailable?: boolean;
  distanceToPowerSource?: number;
  distanceToPowerSourceUnit?: string;
  electricalNotes?: string;

  // Structural Assessment
  wallType?: "Concrete" | "ACP Cladding" | "Glass" | "Tile" | "Metal" | "Wood" | "Composite Panel" | string;
  mountingMethod?: "Direct Mount" | "Frame Mount" | "Hanging" | "Pole Mounted" | string;
  surfaceCondition?: string;
  obstacles?: string[];
  structuralNotes?: string;
}



// Extended Site Visit Details
export interface SiteVisitDetails {
  completed: boolean;
  
  // Stage 1: Pending & Details
  customerAddress?: string;
  landmark?: string;
  preferredDate?: string;
  preferredTime?: string;
  gpsLocation?: string; // e.g. "12.9716° N, 77.5946° E"
  // Stage 2: Scheduling & Booking
  auditDate?: string;     // Booked date
  auditTime?: string;     // Booked time

  locations?: SignLocation[]; // Updated to use new SignLocation type

  // Stage 5: Review & Statuses
  reviewStatus?: "Approved" | "Revisit" | "MoreInfo" | "Pending" | "Pending Admin Approval" | "Draft" | "Needs Revision" | "Rejected" | "Staff Approved";
  
  internalNotes?: string;

  // Installation Requirements
  scaffoldingRequired?: boolean;
  craneRequired?: boolean;
  overnightInstallation?: boolean;

  // Fabrication Requirements
  extraAnglesRequired?: boolean;
  extraAnglesLength?: string;
  extraAcpSheetRequired?: boolean;
  oldBoardRemovalRequired?: boolean;
  extraWireRequired?: boolean;

  // Design Inputs
  designBriefAvailable?: "Yes" | "No" | "Later";
  fabricationRequired?: boolean;
  civilWorkRequired?: boolean;
}

export interface QuoteItem {
  id: string;
  productId?: string;          // links to products.id
  description: string;
  quantity: number;
  pricingType?: "per_unit" | "per_sqft";
  unit?: string;               // "nos" | "sqft"
  unitPrice: number;           // base rate from catalogue (editable)
  totalSqFt?: number;          // kept in sync with quantity (Qty/Measurement)
  gstRate: number;             // 0 | 5 | 12 | 18 | 28
}

export interface QuoteDetails {
  items: QuoteItem[];
  discount: number;
  subtotal: number;
  tax: number;
  grandTotal: number;
  status?: "Draft" | "Sent" | "Approved" | "Rejected";
  notes?: string;
  terms?: string;
  validUntil?: string;
  quotationId?: string;        // e.g. "QT-001"
}

export interface DesignResource {
  id: string;
  url: string;
  name: string;
  type: "link" | "file";
  uploadedBy: "Customer" | "Staff";
  createdAt: string;
}

export interface DesignComment {
  id: string;
  x: number; // percentage X position on the canvas
  y: number; // percentage Y position on the canvas
  content: string;
  author: string;
  createdAt: string;
  isGeneral?: boolean;
  isDraft?: boolean;
  number?: number;
}

export interface DesignVersion {
  id: string;
  versionNumber: number;
  proofUrl: string;
  fileName: string;
  aiFileUrl?: string; 
  status: "Draft" | "Pending Admin" | "Sent to Customer" | "Changes Requested" | "Approved";
  comments: DesignComment[];
  createdAt: string;
}

export interface DesignItem {
  id: string;
  name: string;
  versions: DesignVersion[];
  currentVersion: number;
  productionFiles?: { id: string; name: string; url: string; createdAt: string }[];
}

export interface DesignRecord {
  id: string;
  order_id: string;
  resources: DesignResource[];
  items: DesignItem[];
  created_at: string;
  updated_at: string;
}

export interface ProductionDetails {
  procurementOfMaterials: boolean;
  acpAndAcrylicCutting: boolean;
  lightingAndWiring: boolean;
  qualityCheck: boolean;
}

export interface InstallationDetails {
  photoUrl?: string; // Legacy support
  customerSignature?: string;
  paymentCode?: string;
  gmapLink?: string;
  gmapRequested?: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  afterPhotos?: string[];
  checklist?: { id: string; label: string; checked: boolean }[];
  notes?: string;
}

export interface Order {
  id: string;
  projectName: string;
  customerId: string;
  customerName?: string;
  stage: PipelineStage;
  productType?: string;
  requirements?: string;
  assignedEmployees: string[];
  dateCreated: string;
  versionHistory: VersionItem[];
  chatHistory: ChatMessage[];
  siteVisitDetails?: SiteVisitDetails;
  design?: DesignRecord;
  productionDetails?: ProductionDetails;
  installationDetails?: InstallationDetails;
  stageStatus?: "Normal" | "Pending Admin Approval: Site Visit Completed" | "Pending Admin Approval: Quote Stage" | "Pending Admin Approval: Quote Approval" | "Pending Admin Approval: Design Approval" | "Pending Admin Approval: Production Ready" | "Pending Admin Approval: Job Done" | string;
  stageAdminNotes?: string;
  orderCode?: string;
  health?: string;
  lost_reason?: string;
  orderId?: string;
  /** Determines whether Quote or Design comes first after Site Visit */
  workflow_type?: "quote_first" | "design_first";
}

/** Payment tracking statuses (financial record only — no workflow). */
export type PaymentStatus = "expected" | "received";

export type PaymentAmountType = "fixed" | "percentage";

export interface Payment {
  id: string;
  order_id: string;
  payment_name: string;
  /** Optional note of order stage when recorded (not a gate). */
  trigger_stage: string;
  amount_type: PaymentAmountType;
  amount?: number | null;
  percentage?: number | null;
  calculated_amount?: number | null;
  status: PaymentStatus;
  notes?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type EnquirySource = "Meta Ads" | "Referrals" | "Walk-ins" | "Google Enquiry (Ph Call)" | "Website";

export interface Enquiry {
  id: string;
  dateReceived: string; // ISO format
  leadName: string;
  businessName?: string;
  phone: string;
  whatsapp: string;
  email: string;
  source: EnquirySource;
  status: "Pending" | "Converted";
  notes?: string;
  primaryCommunicationMode: "MAIL" | "WHATSAPP";
  location: string;
  enquireId?: string;
  customerId?: string;
  orderId?: string;
}


export interface Activity {
  id: string;
  timestamp: string;
  user: string;
  description: string;
  originalOrdersState: Order[];
}
