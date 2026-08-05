"use client";

import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { TaskRecord } from "@/features/tasks/types";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailPanel } from "./TaskDetailPanel";

interface TasksDashboardProps {
  tasks: TaskRecord[];
  employees: Array<{ id: string; name: string }>;
  orders: Array<{ id: string; label: string }>;
  isAdmin: boolean;
}

function badgeClass(priority: string) {
  if (priority === "Critical") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "High") return "bg-orange-100 text-orange-700 border-orange-200";
  if (priority === "Low") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

export function TasksDashboard({
  tasks,
  employees,
  orders,
  isAdmin,
}: TasksDashboardProps) {
  const [allTasks] = useState<TaskRecord[]>(tasks);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return allTasks.filter((task) => {
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const text = search.toLowerCase();
      return (
        task.title.toLowerCase().includes(text) ||
        task.task_id.toLowerCase().includes(text) ||
        (task.assignee_name || "").toLowerCase().includes(text)
      );
    });
  }, [allTasks, search, statusFilter]);

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-5 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-xl sm:text-2xl font-extrabold text-slate-900">Task Dashboard</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Assign and track employee tasks across teams.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Assign Task
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search task, assignee, ID..."
          className="w-full sm:min-w-[220px] sm:flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="ALL">All statuses</option>
          {[
            "Not Started",
            "In Progress",
            "Waiting for Approval",
            "Blocked",
            "Completed",
            "Cancelled",
          ].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => setSelectedTask(task)}
            className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{task.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{task.task_id}</div>
              </div>
              <span
                className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass(task.priority)}`}
              >
                {task.priority}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>{task.assignee_name || "Unassigned"}</span>
              <span className="text-slate-300">·</span>
              <span>{task.status}</span>
              {task.due_date ? (
                <>
                  <span className="text-slate-300">·</span>
                  <span>Due {task.due_date}</span>
                </>
              ) : null}
            </div>
          </button>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No tasks found.
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[880px]">
          <thead className="bg-slate-50">
            <tr>
              {["Assigned To", "Task", "Priority", "Due Date", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => (
              <tr key={task.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-sm text-slate-700">{task.assignee_name || "-"}</td>
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                  <div className="text-xs text-slate-500">{task.task_id}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass(task.priority)}`}
                  >
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{task.due_date || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{task.status}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTask(task)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No tasks found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isCreateOpen ? (
        <CreateTaskModal
          employees={employees}
          orders={orders}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => window.location.reload()}
        />
      ) : null}

      {selectedTask ? (
        <TaskDetailPanel
          task={selectedTask}
          isAdmin={isAdmin}
          onClose={() => setSelectedTask(null)}
        />
      ) : null}
    </div>
  );
}
