import React from "react";
import { EmployeesViewNew } from "@/features/employees/components/EmployeesViewNew";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";

export default async function EmployeesPage() {
  const [employeesData, profile] = await Promise.all([
    getEmployees(),
    getCurrentUser(),
  ]);

  const mappedEmployees = employeesData?.map(e => ({
    id: e.id,
    employeeId: e.employeeId,
    name: e.name,
    role: e.staff_role || "",
    phone: e.phone || "",
    email: e.email || "",
    status: e.status || "Active",
    rating: Number(e.rating) || 5.0,
    workload: Number(e.workload) || 0,
    jobsAssigned: e.jobsAssigned || 0
  })) || [];

  return (
    <EmployeesViewNew
      initialEmployees={mappedEmployees}
      companyId={profile?.company_id ?? null}
    />
  );
}
