import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as orderActions from '@/features/orders/actions/orderActions';

// Mocks
vi.mock('@supabase/ssr', () => {
  const mockFilterBuilder: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    // Make it awaitable
    then: vi.fn((resolve) => resolve({ data: null, error: null }))
  };
  
  // set up the circular returns
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'not', 'in', 'order', 'maybeSingle', 'single'];
  methods.forEach(m => {
    mockFilterBuilder[m].mockReturnValue(mockFilterBuilder);
  });
  
  const mockQueryBuilder = {
    select: mockFilterBuilder.select,
    insert: mockFilterBuilder.insert,
    update: mockFilterBuilder.update,
    delete: mockFilterBuilder.delete,
    upsert: mockFilterBuilder.upsert,
  };

  const mockSupabaseInstance = {
    from: vi.fn(() => mockQueryBuilder),
  };

  return {
    createServerClient: vi.fn(() => mockSupabaseInstance),
    __mockFilterBuilder: mockFilterBuilder,
    __mockSupabaseInstance: mockSupabaseInstance,
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    setAll: vi.fn(),
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/features/orders/workspace/shared/serverPermissions', () => ({
  assertAdminOnly: vi.fn(),
  assertStageEditPermission: vi.fn(),
  assertOrderUpdateAccess: vi.fn(),
  assertCanAssignOrderTeam: vi.fn(),
  assertStaffOrAdmin: vi.fn(),
}));

vi.mock('@/features/orders/actions/revalidateOrderPaths', () => ({
  revalidateOrderDetailPaths: vi.fn(),
  revalidateStaffOrderDetailPaths: vi.fn(),
}));

vi.mock('@/features/orders/activity/logOrderActivity', () => ({
  insertOrderActivity: vi.fn(),
}));

vi.mock('@/lib/resolveWriteCompanyId', () => ({
  resolveWriteCompanyId: vi.fn().mockResolvedValue('company-123'),
}));

vi.mock('@/features/notifications/actions/dispatchNotification', () => ({
  dispatchWhatsAppNotification: vi.fn().mockResolvedValue(true),
  dispatchWhatsAppForPipelineStage: vi.fn().mockResolvedValue(true),
  notifyOrderStageChange: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/features/notifications/lib/dispatchNotification', () => ({
  dispatchDirectNotification: vi.fn(),
  dispatchAdminNotification: vi.fn(),
}));

vi.mock('@/features/payments/actions/paymentActions', () => ({
  getPaymentBalanceSummary: vi.fn(),
}));

// We need to import the mocked modules to change their return values in tests
import { assertAdminOnly, assertStageEditPermission, assertOrderUpdateAccess, assertCanAssignOrderTeam } from '@/features/orders/workspace/shared/serverPermissions';
import { getPaymentBalanceSummary } from '@/features/payments/actions/paymentActions';

describe('orderActions', () => {
  let mockSupabase: any;
  let mockFilterBuilder: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Extract the mock builders to set up responses
    const ssrMock = await import('@supabase/ssr');
    mockSupabase = (ssrMock as any).__mockSupabaseInstance;
    mockFilterBuilder = (ssrMock as any).__mockFilterBuilder;
    // Reset Once-queue so a failed/short prior test cannot leak mock responses.
    mockFilterBuilder.then.mockReset();
    mockFilterBuilder.then.mockImplementation((resolve: any) => resolve({ data: [], error: null }));
  });

  describe('getOrders', () => {
    it('should fetch and map orders correctly, handling nulls', async () => {
      const mockDbOrders = [
        {
          id: 'order-1',
          date_created: '2026-08-01T00:00:00Z',
          site_visits: [{ id: 'sv-1' }],
          order_assignments: [{ employee_id: 'emp-1' }],
          designs: [],
          installations: null,
          productions: [{ id: 'prod-1' }],
          quotations: [],
          payments: [],
        },
      ];

      mockFilterBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: mockDbOrders, error: null }));

      const result = await orderActions.getOrders();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('order-1');
      expect(result[0].assigned_employees).toEqual(['emp-1']);
      expect(result[0].siteVisitDetails?.id).toBe('sv-1');
      expect(result[0].design).toBeNull();
      expect(result[0].installationDetails).toBeNull();
      expect(result[0].productionDetails?.id).toBe('prod-1');
    });

    it('should throw error if fetching orders fails', async () => {
      mockFilterBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: null, error: { message: 'DB Error' } }));
      await expect(orderActions.getOrders()).rejects.toThrow('DB Error');
    });
  });

  describe('getOrderById', () => {
    it('should fetch order by uuid, map data correctly', async () => {
      const mockOrder = {
        id: 'uuid-1234',
        order_id: 'ORD-123',
        site_visits: [],
        designs: [{ id: 'des-1', items: [], resources: [] }],
      };

      mockFilterBuilder.then
        // first call: try by id
        .mockImplementationOnce((resolve: any) => resolve({ data: mockOrder, error: null }))
        // next select is for order_assignments
        .mockImplementationOnce((resolve: any) => resolve({ data: [{ employee_id: 'emp-1' }], error: null }));

      const result = await orderActions.getOrderById('uuid-1234');
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe('uuid-1234');
        expect(result.assigned_employees).toEqual(['emp-1']);
        expect(result.design?.id).toBe('des-1');
      }
    });

    it('should fetch by friendly order_id if uuid fails', async () => {
      const mockOrder = { id: 'uuid-1234', order_id: 'ORD-123' };
      
      mockFilterBuilder.then
        // maybeSingle by uuid fails
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: { code: '22P02' } }))
        // maybeSingle by order_id succeeds
        .mockImplementationOnce((resolve: any) => resolve({ data: mockOrder, error: null }))
        // order_assignments
        .mockImplementationOnce((resolve: any) => resolve({ data: [], error: null }));

      const result = await orderActions.getOrderById('ORD-123');
      expect(result?.id).toBe('uuid-1234');
    });
  });

  describe('createOrder', () => {
    it('should create order, create empty design, and log activity', async () => {
      const formData = { client_name: 'Test Client', product_type: 'Signage' };
      const createdOrder = { id: 'uuid-1', order_id: 'ORD-1', company_id: 'company-123', client_name: 'Test Client' };

      mockFilterBuilder.then
        // orders.insert -> select
        .mockImplementationOnce((resolve: any) => resolve({ data: [createdOrder], error: null }))
        // designs.insert
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }));

      const result = await orderActions.createOrder(formData);

      expect(assertAdminOnly).toHaveBeenCalled();
      expect(result[0].id).toBe('uuid-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
      expect(mockSupabase.from).toHaveBeenCalledWith('designs');
    });
  });

  describe('updateOrder', () => {
    it('should resolve order UUID and update it', async () => {
      mockFilterBuilder.then
        // resolveOrderUuid call
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'uuid-1' }, error: null }))
        // orders.update call -> eq -> select
        .mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'uuid-1', order_id: 'ORD-1' }], error: null }));

      await orderActions.updateOrder('ORD-1', { requirements: 'New req' });

      expect(assertOrderUpdateAccess).toHaveBeenCalledWith({ requirements: 'New req' });
      expect(mockFilterBuilder.update).toHaveBeenCalled();
    });
  });

  describe('adminApproveStageAction', () => {
    it('should ensure assertAdminOnly is called', async () => {
      mockFilterBuilder.then
        // resolveOrderUuid
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'uuid-1' }, error: null }))
        // fetch current order state
        .mockImplementationOnce((resolve: any) => resolve({ data: { stage: 'Site Visit Pending', order_id: 'ORD-1', workflow_type: 'quote_first' }, error: null }))
        // updateOrder resolveUuid again inside it
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'uuid-1' }, error: null }))
        // updateOrder update
        .mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'uuid-1' }], error: null }));

      await orderActions.adminApproveStageAction('uuid-1');
      
      expect(assertAdminOnly).toHaveBeenCalled();
    });

    it('should block completing order if balance is outstanding', async () => {
      mockFilterBuilder.then
        // resolveOrderUuid
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'uuid-1' }, error: null }))
        // fetch current order state
        .mockImplementationOnce((resolve: any) => resolve({ data: { stage: 'Installation Scheduled', stage_status: 'Pending Admin Approval: Job Done', order_id: 'ORD-1' }, error: null }));

      vi.mocked(getPaymentBalanceSummary).mockResolvedValueOnce({
        totalAmount: 500,
        gst: 0,
        grandTotal: 500,
        totalBeforeTax: 500,
        expectedTotal: 500,
        receivedTotal: 0,
        outstanding: 500,
      });

      await expect(orderActions.adminApproveStageAction('uuid-1')).rejects.toThrow(/is still outstanding/);
    });
  });

  describe('Stage Actions Security', () => {
    it('updateSiteVisitDetailsAction should check assertStageEditPermission', async () => {
      mockFilterBuilder.then
        // resolveOrderUuid
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'uuid-1' }, error: null }))
        // select company_id
        .mockImplementationOnce((resolve: any) => resolve({ data: { company_id: 'c1', order_id: 'ORD-1' }, error: null }))
        // upsert site_visits
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'sv-1' }, error: null }));
      
      await orderActions.updateSiteVisitDetailsAction('ORD-1', {});
      
      expect(assertStageEditPermission).toHaveBeenCalledWith('site_visit');
    });

    it('updateProductionDetailsAction should check assertStageEditPermission', async () => {
      mockFilterBuilder.then
        // resolveOrderUuid
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'uuid-1' }, error: null }))
        // fetch current production
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }))
        // insert production
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }));
      
      await orderActions.updateProductionDetailsAction('ORD-1', {});
      
      expect(assertStageEditPermission).toHaveBeenCalledWith('production');
    });
  });

  describe('createOrder company scope', () => {
    it('stamps resolveWriteCompanyId onto the insert payload', async () => {
      const { resolveWriteCompanyId } = await import('@/lib/resolveWriteCompanyId');
      vi.mocked(resolveWriteCompanyId).mockResolvedValueOnce('company-slug-uuid');

      mockFilterBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ id: 'uuid-1', order_id: 'A001-001', company_id: 'company-slug-uuid', client_name: 'X' }],
            error: null,
          })
        )
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }));

      await orderActions.createOrder({ client_name: 'X', customer_id: 'cust-1' });

      expect(mockFilterBuilder.insert).toHaveBeenCalled();
      const insertArg = mockFilterBuilder.insert.mock.calls.find(
        (c: any[]) => Array.isArray(c[0]) && c[0][0]?.client_name === 'X'
      )?.[0]?.[0];
      expect(insertArg?.company_id).toBe('company-slug-uuid');
    });
  });

  describe('deleteOrder', () => {
    it('hard-deletes by uuid', async () => {
      mockFilterBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { order_id: 'A001-003' }, error: null })
        )
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }));

      await orderActions.deleteOrder('uuid-1');

      expect(assertAdminOnly).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('orders');
      expect(mockFilterBuilder.delete).toHaveBeenCalled();
    });
  });

  describe('updateOrderHealthAction', () => {
    it('rejects invalid health and Lost without reason', async () => {
      await expect(orderActions.updateOrderHealthAction('uuid-1', 'Warning' as any)).rejects.toThrow(
        /Invalid health/
      );
      await expect(orderActions.updateOrderHealthAction('uuid-1', 'Lost')).rejects.toThrow(
        /reason is required/
      );
    });

    it('updates On Hold and logs activity with company_id', async () => {
      const { insertOrderActivity } = await import('@/features/orders/activity/logOrderActivity');

      mockFilterBuilder.then
        // fetch order_id, company_id, stage
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: { order_id: 'A001-001', company_id: 'company-123', stage: 'Production' },
            error: null,
          })
        )
        // updateOrder().update().select()
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ id: 'uuid-1', order_id: 'A001-001', health: 'On Hold' }],
            error: null,
          })
        );

      await orderActions.updateOrderHealthAction('uuid-1', 'On Hold', undefined, undefined, {
        note: 'Waiting on approval',
        reachOutAt: '2026-08-20',
      });

      expect(assertAdminOnly).toHaveBeenCalled();
      expect(insertOrderActivity).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          company_id: 'company-123',
          order_id: 'A001-001',
          metadata: expect.objectContaining({ action: 'health_changed', health: 'On Hold' }),
        })
      );
    });
  });

  describe('assignTeamToOrder', () => {
    it('requires assign permission before writing assignments', async () => {
      const orderUuid = '11111111-1111-1111-1111-111111111111';
      mockFilterBuilder.then
        // select order_id, company_id
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { order_id: 'A001-001', company_id: 'company-123' }, error: null })
        )
        // delete assignments
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }))
        // insert assignments
        .mockImplementationOnce((resolve: any) => resolve({ data: null, error: null }))
        // notify: users select
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ id: 'emp-1', name: 'Emp' }], error: null })
        );

      await orderActions.assignTeamToOrder(orderUuid, ['emp-1']);

      expect(assertCanAssignOrderTeam).toHaveBeenCalled();
    });
  });

  describe('requestStageAdvancementAction', () => {
    it('logs stage_advancement_requested activity', async () => {
      const { insertOrderActivity } = await import('@/features/orders/activity/logOrderActivity');
      const orderUuid = '11111111-1111-1111-1111-111111111111';

      mockFilterBuilder.then
        // fetch current stage
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: { stage: 'Production', workflow_type: 'quote_first' },
            error: null,
          })
        )
        // updateOrder update (uuid resolves without lookup)
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ id: orderUuid, order_id: 'A001-001', stage_status: 'Pending Admin Approval: Production Ready' }],
            error: null,
          })
        )
        // fetch for activity/notify
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { order_id: 'A001-001', company_id: 'company-123' }, error: null })
        );

      await orderActions.requestStageAdvancementAction(orderUuid);

      expect(assertStageEditPermission).toHaveBeenCalledWith('production');
      expect(insertOrderActivity).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          company_id: 'company-123',
          metadata: expect.objectContaining({
            action: 'stage_advancement_requested',
            from_stage: 'Production',
          }),
        })
      );
    });
  });
});
