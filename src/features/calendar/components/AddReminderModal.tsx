"use client";

import React, { useMemo, useState } from "react";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import type { CalendarEmployeeInput } from "@/features/calendar/types";
import { createCalendarReminderAction } from "@/features/calendar/actions/reminderActions";

interface AddReminderModalProps {
  isOpen: boolean;
  employees: CalendarEmployeeInput[];
  currentUserId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddReminderModal({
  isOpen,
  employees,
  currentUserId,
  onClose,
  onCreated,
}: AddReminderModalProps) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const otherEmployees = useMemo(
    () => employees.filter((e) => e.id !== currentUserId),
    [employees, currentUserId]
  );

  if (!isOpen) return null;

  const toggleViewer = (id: string) => {
    setViewerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!reminderDate) {
      setError("Pick a reminder date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createCalendarReminderAction({
        title: title.trim(),
        note: note.trim() || null,
        reminderDate,
        viewerIds,
      });
      setTitle("");
      setNote("");
      setReminderDate("");
      setViewerIds([]);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create reminder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
        onClick={onClose}
      >
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-slate-200 bg-white shadow-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <h2 className="m-0 text-base font-extrabold text-slate-900">Add reminder</h2>
          <p className="m-0 mt-1 text-xs text-slate-500">
            Create a calendar reminder and choose who can see it.
          </p>

          <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Follow up with…"
            autoFocus
          />

          <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Date
          </label>
          <input
            type="date"
            value={reminderDate}
            onChange={(e) => setReminderDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Visible to
          </label>
          <p className="m-0 mt-0.5 text-[11px] text-slate-400">You can always see reminders you create.</p>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {otherEmployees.length === 0 ? (
              <p className="m-0 text-xs text-slate-400">No other people to share with.</p>
            ) : (
              otherEmployees.map((emp) => {
                const checked = viewerIds.includes(emp.id);
                return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleViewer(emp.id)}
                    />
                    <span>{emp.name}</span>
                  </label>
                );
              })
            )}
          </div>

          {error ? <p className="m-0 mt-2 text-xs font-semibold text-red-600">{error}</p> : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add reminder"}
            </button>
          </div>
        </form>
      </div>
    </OverlayPortal>
  );
}
