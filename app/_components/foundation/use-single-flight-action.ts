"use client";

import { useCallback, useRef, useState } from "react";

export type SingleFlightAction<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

export function useSingleFlightAction<TArgs extends unknown[], TResult>(action: SingleFlightAction<TArgs, TResult>) {
  const activePromise = useRef<Promise<TResult> | null>(null);
  const [pending, setPending] = useState(false);

  const run = useCallback((...args: TArgs) => {
    if (activePromise.current) return activePromise.current;

    setPending(true);
    const execution = Promise.resolve().then(() => action(...args));
    activePromise.current = execution;

    const settle = () => {
      if (activePromise.current !== execution) return;
      activePromise.current = null;
      setPending(false);
    };

    execution.then(settle, settle);
    return execution;
  }, [action]);

  return { run, pending } as const;
}
