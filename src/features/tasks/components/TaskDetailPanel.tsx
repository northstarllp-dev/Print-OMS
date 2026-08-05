"use client";

import React, { useEffect, useState, useTransition } from "react";
import type { TaskCommentRecord, TaskRecord } from "@/features/tasks/types";
import {
  addTaskCommentAction,
  getTaskComments,
  updateTaskAction,
} from "@/features/tasks/actions/taskActions";
import { OverlayPortal } from "@/components/ui/OverlayPortal";

interface TaskDetailPanelProps {
  task: TaskRecord;
  isAdmin: boolean;
  onClose: () => void;
}

export function TaskDetailPanel({ task, isAdmin: _isAdmin, onClose }: TaskDetailPanelProps) {
  const [comments, setComments] = useState<TaskCommentRecord[]>([]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState(task.status);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(task.status);
  }, [task.id, task.status]);

  useEffect(() => {
    let active = true;
    void getTaskComments(task.id).then((rows) => {
      if (active) setComments(rows);
    });
    return () => {
      active = false;
    };
  }, [task.id]);

  const markCompleted = () => {
    startTransition(async () => {
      await updateTaskAction(task.id, { status: "Completed" });
      setStatus("Completed");
    });
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    startTransition(async () => {
      await addTaskCommentAction(task.id, comment);
      setComment("");
      setComments(await getTaskComments(task.id));
    });
  };

  const isCompleted = status === "Completed";

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex w-full sm:max-w-md max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl sm:rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
            <div className="min-w-0">
              <h2 className="m-0 truncate text-base font-extrabold text-slate-900">
                {task.title}
              </h2>
              <p className="m-0 mt-0.5 text-[11px] text-slate-500">
                {task.task_id} · {task.assignee_name || "Unassigned"} · {task.priority}
                {task.due_date ? ` · Due ${task.due_date}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <span
                className={`inline-flex self-start rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  isCompleted
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {status}
              </span>
              {!isCompleted ? (
                <button
                  type="button"
                  onClick={markCompleted}
                  disabled={isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50 w-full sm:w-auto"
                >
                  {isPending ? "Saving…" : "Mark Completed"}
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                Comments
              </h3>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add comment"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={isPending || !comment.trim()}
                className="w-full sm:w-auto rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Add comment
              </button>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {comments.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 p-2">
                    <div className="text-[11px] font-semibold text-slate-700">
                      {entry.author_name || "User"}
                    </div>
                    <div className="text-xs text-slate-600">{entry.body}</div>
                  </div>
                ))}
                {comments.length === 0 ? (
                  <p className="m-0 text-xs text-slate-400">No comments yet</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
