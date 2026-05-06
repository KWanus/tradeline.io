import { redirect } from "next/navigation";

// Legacy route — workspace lives at /app/today now.
export default function RadarRedirect() {
  redirect("/app/today");
}
