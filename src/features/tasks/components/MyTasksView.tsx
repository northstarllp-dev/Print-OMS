"use client";

import React, { useMemo, useState } from "react";
import type { TaskRecord } from "@/features/tasks/types";
import { TaskDetailPanel } from "./TaskDetailPanel";

interface MyTasksViewProps {
  tasks: TaskRecord[];
}

function bucketForTask(task: TaskRecord, today: string) {
  if (task.status === "Completed") return "completed";
  if (!task.due_date) return "upcoming";
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  return "upcoming";
}

export function MyTasksView({ tasks }: MyTasksViewProps) {
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const buckets = useMemo(() => {
    const out = {
      today: [] as TaskRecord[],
      overdue: [] as TaskRecord[],
      upcoming: [] as TaskRecord[],
      completed: [] as TaskRecord[],
    };
    for (const task of tasks) {
      out[bucketForTask(task, today)].push(task);
    }
    return out;
  }, [tasks, today]);

  const sections: Array<{
    key: keyof typeof buckets;
    label: string;
  }> = [
    { key: "today", label: "Today's Tasks" },
    { key: "overdue", label: "Overdue Tasks" },
    { key: "upcoming", label: "Upcoming Tasks" },
    { key: "completed", label: "Completed Tasks" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div>
        <h1 className="m-0 text-2xl font-extrabold text-slate-900">My Tasks</h1>
        <p className="m-0 mt-1 text-sm text-slate-500">
          Tasks assigned to you with due dates.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.key} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-sm font-bold text-slate-800">{section.label}</h2>
            <span className="text-xs text-slate-500">{buckets[section.key].length}</span>
          </div>
          <div className="space-y-2">
            {buckets[section.key].map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelectedTask(task)}
                className="w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                    <div className="text-xs text-slate-500">
                      {task.task_id} · Due: {task.due_date || "-"}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-600">{task.status}</div>
                </div>
              </button>
            ))}
            {buckets[section.key].length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                No tasks
              </div>
            ) : null}
          </div>
        </div>
      ))}

      {selectedTask ? (
        <TaskDetailPanel
          task={selectedTask}
          isAdmin={false}
          onClose={() => setSelectedTask(null)}
        />
      ) : null}
    </div>
  );
}
