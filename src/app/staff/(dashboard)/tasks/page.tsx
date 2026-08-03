import React from "react";
import { getTasks } from "@/features/tasks/actions/taskActions";
import { MyTasksView } from "@/features/tasks/components/MyTasksView";

export const metadata = {
  title: "My Tasks | Staff",
};

export default async function StaffTasksPage() {
  const tasks = await getTasks();
  return <MyTasksView tasks={tasks} />;
}
