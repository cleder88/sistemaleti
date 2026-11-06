"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UrlContext {
  month: string | null;
  storeId: string | null;
  product: string | null;
}

const EMPTY_CONTEXT: UrlContext = {
  month: null,
  storeId: null,
  product: null,
};

function isValidMonthKey(value: string | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function readContextFromLocation(): UrlContext {
  if (typeof window === "undefined") return EMPTY_CONTEXT;

  const params = new URLSearchParams(window.location.search);
  const month = params.get("mes");
  const storeId = params.get("loja")?.trim() ?? "";
  const product = params.get("produto")?.trim() ?? "";

  return {
    month: isValidMonthKey(month) ? month : null,
    storeId: storeId || null,
    product: product || null,
  };
}

export function useUrlContext() {
  const [context, setContext] = useState<UrlContext>(EMPTY_CONTEXT);
  const [ready, setReady] = useState(false);
  const contextRef = useRef<UrlContext>(EMPTY_CONTEXT);

  useEffect(() => {
    function syncFromLocation() {
      const next = readContextFromLocation();
      contextRef.current = next;
      setContext(next);
    }

    syncFromLocation();
    setReady(true);
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const updateContext = useCallback(
    (
      patch: Partial<UrlContext>,
      options?: { hash?: string | null }
    ) => {
      if (typeof window === "undefined") return;

      const next: UrlContext = { ...contextRef.current, ...patch };
      const params = new URLSearchParams(window.location.search);

      function applyParam(key: string, value: string | null | undefined) {
        if (value === undefined) return;
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      applyParam("mes", next.month);
      applyParam("loja", next.storeId);
      applyParam("produto", next.product);

      const query = params.toString();
      const hash =
        options?.hash === undefined ? window.location.hash : options.hash;
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${
        hash ?? ""
      }`;

      window.history.replaceState(null, "", nextUrl);
      contextRef.current = next;
      setContext(next);
    },
    []
  );

  return { context, updateContext, ready };
}
