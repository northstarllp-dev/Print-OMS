"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_TYPES,
  type TaskRecord,
} from "@/features/tasks/types";
import { createTaskAction } from "@/features/tasks/actions/taskActions";

interface EmployeeOption {
  id: string;
  name: string;
}

interface OrderOption {
  id: string;
  label: string;
}

interface CreateTaskModalProps {
  employees: EmployeeOption[];
  orders: OrderOption[];
  onClose: () => void;
  onCreated: (task: Pick<TaskRecord, "id">) => void;
}

export function CreateTaskModal({
  employees,
  orders,
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof TASK_CATEGORIES)[number]>("Internal");
  const [taskType, setTaskType] = useState<(typeof TASK_TYPES)[number]>("Administration");
  const [priority, setPriority] = useState<(typeof TASK_PRIORITIES)[number]>("Medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    employees[0]?.id ? [employees[0].id] : []
  );
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assigneeRef = useRef<HTMLDivElement | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [orderId, setOrderId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const canSubmit = title.trim().length > 1 && assigneeIds.length > 0;

  const selectedAssigneeLabel = useMemo(() => {
    if (assigneeIds.length === 0) return "Select employees...";
    const names = employees
      .filter((employee) => assigneeIds.includes(employee.id))
      .map((employee) => employee.name);
    if (names.length <= 2) return names.join(", ");
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }, [assigneeIds, employees]);

  useEffect(() => {
    if (!assigneeOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!assigneeRef.current?.contains(event.target as Node)) {
        setAssigneeOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [assigneeOpen]);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    startTransition(async () => {
      try {
        const created = await createTaskAction({
          title,
          description,
          category,
          taskType,
          priority,
          assigneeIds,
          dueDate: dueDate || null,
          orderId: orderId || null,
        });
        onCreated(created);
      } catch (err: any) {
        setError(err?.message || "Unable to create task");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div>
          <h2 className="m-0 text-lg font-extrabold text-slate-900">Assign Task</h2>
          <p className="m-0 mt-1 text-xs text-slate-500">
            Create a new task and assign it to one or more employees.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div ref={assigneeRef} className="relative">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Assign To
            </label>
            <button
              type="button"
              onClick={() => setAssigneeOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700"
            >
              <span className="truncate">{selectedAssigneeLabel}</span>
              <ChevronDown
                size={14}
                className={`shrink-0 text-slate-400 transition-transform ${
                  assigneeOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {assigneeOpen ? (
              <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg space-y-1">
                {employees.length === 0 ? (
                  <p className="m-0 px-1 py-1 text-xs text-slate-400">No employees found</p>
                ) : (
                  employees.map((employee) => {
                    const checked = assigneeIds.includes(employee.id);
                    return (
                      <label
                        key={employee.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                          checked
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignee(employee.id)}
                          className="rounded border-slate-300"
                        />
                        <span className="truncate">{employee.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : null}
            <p className="m-0 mt-1 text-[11px] text-slate-400">
              {assigneeIds.length === 0
                ? "Select one or more employees"
                : `${assigneeIds.length} selected`}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {TASK_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Type
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {TASK_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {TASK_PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Deadline
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Linked Order
            </label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Not linked to an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details..."
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="m-0 text-xs font-semibold text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending
              ? "Assigning..."
              : assigneeIds.length > 1
                ? `Assign to ${assigneeIds.length}`
                : "Assign Task"}
          </button>
        </div>
      </form>
    </div>
  );
}
