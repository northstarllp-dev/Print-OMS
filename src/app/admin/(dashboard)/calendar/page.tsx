import { CalendarDays } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Calendar | Admin",
};

export default function AdminCalendarPage() {
  return (
    <ComingSoonPage
      title="Company Calendar"
      description="View all site visits and installations across the team in a single company-wide calendar."
      icon={CalendarDays}
    />
  );
}
