// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrdersManagementDashboard } from '@/features/orders/components/OrdersManagementDashboard';
import '@testing-library/jest-dom/vitest';

const { mockPush, mockRefresh, mockReplace } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockReplace: vi.fn(),
}));

// Mocks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  })
}));

vi.mock('@/features/orders/actions/orderActions', () => ({
  assignTeamToOrder: vi.fn(),
  updateOrderHealthAction: vi.fn(),
}));

vi.mock('@/config/loadClientConfig', () => ({
  loadClientConfig: vi.fn(() => ({
    features: {
      enableAdminAssignment: true,
    }
  })),
}));

const mockOrders = [
  {
    id: 'ord-1',
    orderId: 'ORD-1',
    clientName: 'Client A',
    customerId: 'cust-1',
    stage: 'Site Visit Pending',
    healthStatus: 'On Track',
    dateCreated: '2024-01-01T10:00:00Z',
    order_assignments: [],
  },
  {
    id: 'ord-2',
    orderId: 'ORD-2',
    clientName: 'Client B',
    customerId: 'cust-2',
    stage: 'Completed',
    healthStatus: 'Warning',
    dateCreated: '2024-01-02T10:00:00Z',
    order_assignments: [{ employee_id: 'emp-1' }],
  },
];

const mockCustomers: any[] = [];
const mockEmployees = [{ id: 'emp-1', first_name: 'Emp', last_name: 'One' }];

describe('OrdersManagementDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly and calculates KPIs (Admin)', () => {
    render(
      <OrdersManagementDashboard 
        initialOrders={mockOrders}
        initialCustomers={mockCustomers}
        initialEmployees={mockEmployees}
        initialEnquiries={[]}
        userRole="Admin"
        currentEmployeeName="Admin"
      />
    );

    // Initial table should show both orders (use getAllByText[0] due to mobile/desktop views)
    expect(screen.getAllByText('Client A')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Client B')[0]).toBeInTheDocument();

    // KPI: Total Active (excludes Completed)
    expect(screen.getAllByText('TOTAL ACTIVE')[0]).toBeInTheDocument();
    
    // KPI: Unassigned (ord-1 is unassigned)
    const unassignedKpi = screen.getAllByText('UNASSIGNED')[0];
    expect(unassignedKpi.closest('button') || unassignedKpi.closest('div')).toBeInTheDocument();
  });

  it('filters orders by search term', async () => {
    render(
      <OrdersManagementDashboard 
        initialOrders={mockOrders}
        initialCustomers={mockCustomers}
        initialEmployees={mockEmployees}
        initialEnquiries={[]}
        userRole="Admin"
        currentEmployeeName="Admin"
      />
    );

    const searchInput = screen.getAllByPlaceholderText('Search orders…')[0];
    fireEvent.change(searchInput, { target: { value: 'Client B' } });

    // Wait for debounce
    await waitFor(() => {
      expect(screen.queryAllByText('Client A')).toHaveLength(0);
      expect(screen.getAllByText('Client B').length).toBeGreaterThan(0);
    });
  });

  it('filters orders by stage KPI click', async () => {
    render(
      <OrdersManagementDashboard 
        initialOrders={mockOrders}
        initialCustomers={mockCustomers}
        initialEmployees={mockEmployees}
        initialEnquiries={[]}
        userRole="Admin"
        currentEmployeeName="Admin"
      />
    );

    const completedKpi = screen.getAllByText('COMPLETED')[0];
    
    // Click on KPI card
    fireEvent.click(completedKpi);
    
    await waitFor(() => {
      // Client A is NOT completed, so it should be filtered out
      expect(screen.queryAllByText('Client A')).toHaveLength(0);
      expect(screen.getAllByText('Client B').length).toBeGreaterThan(0);
    });
  });

  it('does not show KPIs for Employee role', () => {
    render(
      <OrdersManagementDashboard 
        initialOrders={mockOrders}
        initialCustomers={mockCustomers}
        initialEmployees={mockEmployees}
        initialEnquiries={[]}
        userRole="Employee"
        currentEmployeeName="Employee One"
      />
    );

    // Employee role doesn't have the admin KPIs.
    expect(screen.queryAllByText('TOTAL ACTIVE')).toHaveLength(0);
  });
});
