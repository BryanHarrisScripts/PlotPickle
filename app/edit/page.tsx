import type { Metadata } from "next";
import EditWorkspace from "../edit-workspace";

export const metadata: Metadata = {
  title: "Edit · PlotPickle",
  description: "Review and improve the same canonical screenplay used by Write.",
};

export default function EditPage() {
  return <EditWorkspace />;
}
