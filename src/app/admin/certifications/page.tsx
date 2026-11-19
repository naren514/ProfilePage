import { redirect } from "next/navigation";

// The reading list moved to /admin/reading (inbox, notes and ways to save)
export default function LegacyReadingAdmin() {
  redirect("/admin/reading");
}
