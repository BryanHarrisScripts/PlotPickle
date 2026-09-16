"use client";

import { useEffect, useState } from "react";
import PreproductionCapabilityReturn from "./preproduction-capability-return";

export default function PreproductionLearnReturnHost() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setActive(search.get("workspace") === "learn" && search.get("from") === "preproduction");
  }, []);

  return active ? <PreproductionCapabilityReturn /> : null;
}
