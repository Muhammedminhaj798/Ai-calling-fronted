// TypeScript mirror of the backend API responses (backend/src/modules/*/ *.repository.ts includes,
// prisma/schema.prisma enums). Dates are ISO strings and Prisma Decimals are strings on the wire.

export type Role = 'admin' | 'staff' | 'approver';
export type Language = 'en' | 'ml' | 'ta' | 'hi';
export type CallStatus = 'ringing' | 'in_progress' | 'completed' | 'handed_over' | 'failed';
export type ConversationState =
  | 'initializing'
  | 'identifying_customer'
  | 'confirming_location'
  | 'collecting_items'
  | 'matching_products'
  | 'checking_inventory'
  | 'reviewing_shortages'
  | 'building_order'
  | 'reading_back'
  | 'waiting_customer_confirmation'
  | 'handover_required'
  | 'completed'
  | 'failed';
export type OrderStatus =
  | 'draft'
  | 'pending_customer_confirmation'
  | 'customer_confirmed'
  | 'pending_stock_reservation'
  | 'pending_staff_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | 'fulfilled';
export type OrderItemStatus = 'active' | 'flagged';
export type ItemStockStatus = 'unchecked' | 'in_stock' | 'insufficient' | 'out_of_stock' | 'unknown' | 'error';
export type CustomerDecision = 'pending' | 'accepted' | 'declined';
export type ReservationStatus = 'active' | 'consumed' | 'released' | 'expired';
export type ExceptionType =
  | 'product_not_found'
  | 'ambiguous_product'
  | 'insufficient_stock'
  | 'out_of_stock'
  | 'inventory_api_error'
  | 'customer_not_registered'
  | 'customer_not_eligible'
  | 'reservation_failed'
  | 'reservation_expired'
  | 'customer_unconfirmed'
  | 'order_validation_failed'
  | 'human_handover_required'
  | 'low_confidence'
  | 'call_dropped_with_draft'
  | 'duplicate_suspected';
export type ExceptionStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export const LANGUAGES: Language[] = ['en', 'ml', 'ta', 'hi'];
export const CALL_STATUSES: CallStatus[] = ['ringing', 'in_progress', 'completed', 'handed_over', 'failed'];
export const ORDER_STATUSES: OrderStatus[] = ['draft', 'pending_customer_confirmation', 'customer_confirmed', 'pending_stock_reservation', 'pending_staff_approval', 'approved', 'rejected', 'cancelled', 'failed', 'fulfilled'];
export const EXCEPTION_TYPES: ExceptionType[] = ['product_not_found', 'ambiguous_product', 'insufficient_stock', 'out_of_stock', 'inventory_api_error', 'customer_not_registered', 'customer_not_eligible', 'reservation_failed', 'reservation_expired', 'customer_unconfirmed', 'order_validation_failed', 'human_handover_required', 'low_confidence', 'call_dropped_with_draft', 'duplicate_suspected'];
export const EXCEPTION_STATUSES: ExceptionStatus[] = ['open', 'in_progress', 'resolved', 'dismissed'];

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: SafeUser;
}

export interface StaffRef {
  id: string;
  name: string;
  email: string;
}
export interface StaffUser extends StaffRef {
  role: Role;
}

export interface CustomerRef {
  id: string;
  externalCode: string;
  name: string;
}
export interface CustomerContact extends CustomerRef {
  phonePrimary: string;
  status: CustomerStatus;
  preferredLanguage: Language;
}

export interface Address {
  id: string;
  customerId: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  externalCode: string;
  name: string;
  phonePrimary: string;
  phoneAlternates: string[];
  email: string | null;
  gstin: string | null;
  drugLicenseNo: string | null;
  preferredLanguage: Language;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  addresses: Address[];
}

export interface Product {
  id: string;
  externalCode: string;
  name: string;
  brand: string | null;
  genericName: string | null;
  strength: string | null;
  form: string | null;
  packSize: string;
  unit: string | null;
  manufacturer: string | null;
  mrpPaise: number | null;
  ptrPaise: number | null;
  gstRate: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductStock {
  productId: string;
  sku: string;
  name: string;
  source: 'mock' | 'client_api' | 'manual';
  isMock: boolean;
  availableToSell: number | null;
  status: 'in_stock' | 'out_of_stock' | 'unknown';
  requestedQuantity: number | null;
  sufficient: boolean | null;
  asOf: string;
  warning?: string;
}

export interface OrderRef {
  id: string;
  orderNumber: string;
  status: OrderStatus;
}

export interface CallListItem {
  id: string;
  provider: string;
  providerCallSid: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  customerId: string | null;
  status: CallStatus;
  language: Language | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  handoverReason: string | null;
  aiSummary: string | null;
  conversationState: ConversationState;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: CustomerRef | null;
  order: OrderRef | null;
}

export interface CallDetail extends Omit<CallListItem, 'customer' | 'order'> {
  customer: CustomerContact | null;
  order: (OrderRef & { revision: number; totalPaise: number; deliveryAddressId: string | null }) | null;
  exceptions: Array<{ id: string; type: ExceptionType; status: ExceptionStatus; description: string }>;
  _count: { transcripts: number; events: number };
  live: { state: ConversationState; language: Language; turns: number; candidates: number } | null;
}

export interface Transcript {
  id: string;
  callId: string;
  sequence: number;
  speaker: 'customer' | 'agent' | 'system';
  text: string;
  language: Language | null;
  confidence: string | null;
  offsetMs: number | null;
  durationMs: number | null;
  toolCalls: Array<{ name: string; ok: boolean }> | null;
  createdAt: string;
}

export interface CallEvent {
  id: string;
  callId: string;
  type: string;
  fromState: ConversationState | null;
  toState: ConversationState | null;
  toolName: string | null;
  toolCallId: string | null;
  ok: boolean | null;
  data: unknown;
  createdAt: string;
}

/** Shape of `data` on tool_called / tool_failed events (backend conversation.service.ts). */
export interface ToolEventData {
  arguments?: unknown;
  result?: { ok: true; data: unknown } | { ok: false; code: string; error: string; details?: unknown };
}

export interface OrderItem {
  id: string;
  orderId: string;
  lineNo: number;
  productId: string | null;
  requestedText: string;
  quantity: number;
  nameSnapshot: string | null;
  brandSnapshot: string | null;
  strengthSnapshot: string | null;
  formSnapshot: string | null;
  packSizeSnapshot: string | null;
  unitSnapshot: string | null;
  unitPricePaise: number | null;
  lineTotalPaise: number | null;
  matchConfidence: string | null;
  stockStatus: ItemStockStatus;
  stockCheckedAt: string | null;
  availableAtCheck: number | null;
  customerDecision: CustomerDecision;
  status: OrderItemStatus;
  flagReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  status: ReservationStatus;
  provider: string;
  externalReservationRef: string | null;
  idempotencyKey: string | null;
  expiresAt: string;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderConfirmation {
  id: string;
  orderId: string;
  revision: number;
  status: 'pending' | 'confirmed' | 'superseded';
  itemsSnapshot: unknown;
  readbackText: string;
  readbackAt: string;
  source: 'phone_ai' | 'phone_staff' | 'manual' | null;
  confirmedAt: string | null;
  idempotencyKey: string | null;
  actorType: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface StaffApproval {
  id: string;
  orderId: string;
  staffUserId: string;
  decision: 'approved' | 'rejected' | 'modified';
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  note: string | null;
  changes: unknown;
  createdAt: string;
  staffUser: StaffRef;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  actorType: 'staff' | 'system' | 'ai';
  actorId: string | null;
  reason: string | null;
  data: unknown;
  createdAt: string;
}

export interface OrderBase {
  id: string;
  orderNumber: string;
  callId: string | null;
  customerId: string;
  status: OrderStatus;
  revision: number;
  customerPoReference: string | null;
  deliveryAddressId: string | null;
  idempotencyKey: string | null;
  reserveIdempotencyKey: string | null;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: string;
  createdBy: string;
  notes: string | null;
  customerConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrderListLine = Pick<OrderItem, 'id' | 'lineNo' | 'nameSnapshot' | 'requestedText' | 'quantity' | 'status' | 'stockStatus' | 'customerDecision'>;

export interface OrderListItem extends OrderBase {
  items: OrderListLine[];
  customer: CustomerRef;
}

export interface OrderException {
  id: string;
  type: ExceptionType;
  status: ExceptionStatus;
  description: string;
  orderItemId: string | null;
  assignedTo: string | null;
}

/** GET /api/approvals/pending rows: the order detail include without the event history. */
export interface OrderRecord extends OrderBase {
  items: OrderItem[];
  customer: CustomerContact;
  reservations: Reservation[];
  confirmations: OrderConfirmation[];
  approvals: StaffApproval[];
  exceptions: OrderException[];
}

export interface OrderDetail extends OrderRecord {
  events: OrderEvent[];
}

export interface LineAvailability {
  itemId: string;
  sku: string;
  quantity: number;
  availableToSell: number | null;
  status: 'in_stock' | 'insufficient' | 'out_of_stock' | 'unknown';
}

export type ReservationOutcome =
  | { outcome: 'reserved'; orderStatus: OrderStatus; replay: boolean; source: string; isMock: boolean; expiresAt: string | null; lines: LineAvailability[] }
  | { outcome: 'failed'; orderStatus: OrderStatus; reason: string; source: string; isMock: boolean; lines: LineAvailability[]; exceptionId: string };

export interface ExceptionRecord {
  id: string;
  type: ExceptionType;
  status: ExceptionStatus;
  callId: string | null;
  customerId: string | null;
  orderId: string | null;
  orderItemId: string | null;
  description: string;
  details: unknown;
  assignedTo: string | null;
  resolutionNote: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: StaffRef | null;
  resolvedBy: StaffRef | null;
  order: OrderRef | null;
  customer: CustomerRef | null;
  orderItem: { id: string; lineNo: number; requestedText: string; quantity: number; status: OrderItemStatus } | null;
}

export interface ProviderStatus {
  provider: string;
  configured: boolean;
}

export interface Settings {
  environment: 'development' | 'test' | 'production';
  providers: {
    ai: ProviderStatus & { model: string };
    stt: ProviderStatus;
    tts: ProviderStatus;
    telephony: ProviderStatus & { handoverNumberConfigured: boolean; ipAllowListConfigured: boolean };
    inventory: ProviderStatus;
  };
  reservation: { ttlHours: number; sweepIntervalSeconds: number; maxOrderItems: number };
  conversation: { defaultLanguage: Language; maxToolRounds: number; historyMessages: number; idleTimeoutMinutes: number };
}
