"use client";

import { useEffect } from "react";

export default function FeedbackStudioHost() {
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get("workspace") !== "feedback") return;

    parameters.delete("workspace");
    const query = parameters.toString();
    window.location.replace(`/feedback${query ? `?${query}` : ""}`);
  }, []);

  return null;
}
