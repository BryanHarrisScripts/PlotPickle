import { redirect } from "next/navigation";

export default function AiRoutingPage() {
  redirect("/?workspace=settings#settings-routing");
}
