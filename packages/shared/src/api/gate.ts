import type { ApiClient } from './client';
import type { PagedData } from './types';
import { buildQuery, listQueryParams, type ListQuery } from './query';

export interface Visitor {
  id: string;
  communityId: string;
  hostUnitId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  category: string;
  photoFileId?: string | null;
  vehicleNumber?: string | null;
  gateLocation?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  purpose?: string | null;
  whomToMeet?: string | null;
  expectedDurationMinutes?: number | null;
  status: string;
  approvedByResidentId?: string | null;
  approvalDecisionAtUtc?: string | null;
  isAdmittable: boolean;
  qrToken?: string | null;
  hostUnitNumber?: string | null;
  communityName?: string | null;
  organizationName?: string | null;
}

export interface VisitorListFilters {
  status?: string;
  category?: string;
  hostUnitId?: string;
  organizationId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ApproveVisitorBody {
  approvingResidentId: string;
}

export interface RejectVisitorBody {
  rejectingResidentId: string;
  reason?: string;
}

export interface RecurringVisitor {
  id: string;
  communityId: string;
  hostUnitId: string;
  hostResidentId: string;
  name: string;
  phone?: string | null;
  category: string;
  daysOfWeek: number;
  startDate: string;
  endDate: string;
  dailyStartMinutes?: number | null;
  dailyEndMinutes?: number | null;
  status: string;
  photoFileId?: string | null;
}

export interface RecurringVisitorListFilters {
  status?: string;
  category?: string;
  hostUnitId?: string;
  active?: boolean;
}

export interface CreateRecurringVisitorBody {
  hostUnitId: string;
  hostResidentId: string;
  name: string;
  phone?: string;
  category: string;
  daysOfWeek: number;
  startDate: string;
  endDate: string;
  dailyStartMinutes?: number;
  dailyEndMinutes?: number;
  photoFileId?: string;
}

export interface CreateVisitPassBody {
  hostUnitId: string;
  hostResidentId?: string;
  visitorName: string;
  phone?: string;
  email?: string;
  whomToMeet?: string;
  numberOfPersons?: number;
  vehicleNumber?: string;
  vehicleType?: string;
  visitDateUtc?: string;
  validFromUtc?: string;
  validUntilUtc?: string;
  maxUses?: number;
  photoFileId?: string;
}

export interface VisitPass {
  id: string;
  communityId: string;
  hostUnitId: string;
  visitorName: string;
  phone?: string | null;
  email?: string | null;
  vehicleNumber?: string | null;
  vehicleType?: string | null;
  numberOfPersons?: number | null;
  whomToMeet?: string | null;
  visitDateUtc?: string | null;
  photoFileId?: string | null;
  qrToken: string;
  validFromUtc?: string | null;
  validUntilUtc: string;
  maxUses: number;
  useCount: number;
  status: string;
  hostUnitNumber?: string | null;
  organizationName?: string | null;
  publicToken?: string;
}

export interface CreateVisitPassResult {
  pass: VisitPass;
  otp: string;
}

export interface VehicleLookupHostResident {
  name: string;
  phone?: string | null;
  residentType: string;
}

export interface VehicleLookupMatch {
  matchType: string;
  vehicleType?: string | null;
  personName: string;
  personPhone?: string | null;
  personEmail?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  status?: string | null;
  hostResidents: VehicleLookupHostResident[];
}

export interface VehicleLookupResult {
  plate: string;
  matches: VehicleLookupMatch[];
}

export interface VerifyVisitPassBody {
  qrToken?: string;
  otp?: string;
}

export interface VerifyVisitPassResult {
  accepted: boolean;
  rejectionReason?: string | null;
  pass?: VisitPass | null;
}

export interface RegisterWalkInBody {
  hostUnitId: string;
  name: string;
  phone?: string;
  email?: string;
  category: string;
  photoFileId?: string;
  vehicleNumber?: string;
  gateLocation?: string;
  idProofType?: string;
  idProofNumber?: string;
  purpose?: string;
  whomToMeet?: string;
  expectedDurationMinutes?: number;
}

export interface RegisterWalkInResult {
  visitor: Visitor;
  autoApproved: boolean;
  otp?: string | null;
}

export interface EntryExitEvent {
  id: string;
  communityId: string;
  gateId?: string | null;
  gateLabel?: string | null;
  destinationUnitId?: string | null;
  visitorId?: string | null;
  visitPassId?: string | null;
  recurringVisitorId?: string | null;
  visitorName: string;
  category: string;
  vehicleNumber?: string | null;
  entryTsUtc: string;
  exitTsUtc?: string | null;
  hostUnitNumber?: string | null;
  visitorPhone?: string | null;
  photoFileId?: string | null;
  whomToMeet?: string | null;
}

export interface EntryExitFilters {
  category?: string;
  open?: boolean;
  destinationUnitId?: string;
  visitorId?: string;
}

export interface RecordEntryBody {
  visitorId?: string;
  visitPassId?: string;
  recurringVisitorId?: string;
  gateId?: string;
  gateLabel?: string;
  vehicleNumber?: string;
}

export interface RecordExitBody {
  visitorId?: string;
  visitPassId?: string;
  recurringVisitorId?: string;
  gateId?: string;
  gateLabel?: string;
}

export class GateClient {
  constructor(private readonly api: ApiClient) {}

  listVisitors(query: ListQuery = {}, filters: VisitorListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<Visitor>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      status: filters.status,
      category: filters.category,
      hostUnitId: filters.hostUnitId,
      organizationId: filters.organizationId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    });
    return this.api.get<PagedData<Visitor>>(`/api/v1/visitors${qs}`, options);
  }

  getVisitor(id: string, options?: { signal?: AbortSignal }): Promise<Visitor> {
    return this.api.get<Visitor>(`/api/v1/visitors/${id}`, options);
  }

  approveVisitor(id: string, body: ApproveVisitorBody): Promise<Visitor> {
    return this.api.post<Visitor>(`/api/v1/visitors/${id}/approve`, { body });
  }

  rejectVisitor(id: string, body: RejectVisitorBody): Promise<Visitor> {
    return this.api.post<Visitor>(`/api/v1/visitors/${id}/reject`, { body });
  }

  listRecurringVisitors(query: ListQuery = {}, filters: RecurringVisitorListFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<RecurringVisitor>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      status: filters.status,
      category: filters.category,
      hostUnitId: filters.hostUnitId,
      ...(filters.active != null ? { active: filters.active } : {}),
    });
    return this.api.get<PagedData<RecurringVisitor>>(`/api/v1/recurring-visitors${qs}`, options);
  }

  createVisitPass(body: CreateVisitPassBody): Promise<CreateVisitPassResult> {
    return this.api.post<CreateVisitPassResult>('/api/v1/visit-passes', { body });
  }

  createRecurringVisitor(body: CreateRecurringVisitorBody): Promise<RecurringVisitor> {
    return this.api.post<RecurringVisitor>('/api/v1/recurring-visitors', { body });
  }

  revokeRecurringVisitor(id: string): Promise<RecurringVisitor> {
    return this.api.post<RecurringVisitor>(`/api/v1/recurring-visitors/${id}/revoke`, {});
  }

  extendRecurringVisitor(id: string, endDateUtc: string): Promise<RecurringVisitor> {
    return this.api.post<RecurringVisitor>(`/api/v1/recurring-visitors/${id}/extend`, { body: { endDate: endDateUtc } });
  }

  lookupVehicle(plate: string, options?: { signal?: AbortSignal }): Promise<VehicleLookupResult> {
    const qs = buildQuery({ plate });
    return this.api.get<VehicleLookupResult>(`/api/v1/gate/vehicle-lookup${qs}`, options);
  }

  verifyVisitPass(body: VerifyVisitPassBody): Promise<VerifyVisitPassResult> {
    return this.api.post<VerifyVisitPassResult>('/api/v1/visit-passes/verify', { body });
  }

  registerWalkIn(body: RegisterWalkInBody): Promise<RegisterWalkInResult> {
    return this.api.post<RegisterWalkInResult>('/api/v1/visitors', { body });
  }

  listEntryExitEvents(query: ListQuery = {}, filters: EntryExitFilters = {}, options?: { signal?: AbortSignal }): Promise<PagedData<EntryExitEvent>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      category: filters.category,
      destinationUnitId: filters.destinationUnitId,
      visitorId: filters.visitorId,
      ...(filters.open != null ? { open: filters.open } : {}),
    });
    return this.api.get<PagedData<EntryExitEvent>>(`/api/v1/entry-events${qs}`, options);
  }

  recordEntry(body: RecordEntryBody): Promise<EntryExitEvent> {
    return this.api.post<EntryExitEvent>('/api/v1/entry-events/entry', { body });
  }

  recordExit(body: RecordExitBody): Promise<EntryExitEvent> {
    return this.api.post<EntryExitEvent>('/api/v1/entry-events/exit', { body });
  }
}
