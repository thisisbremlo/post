import { useEffect, useState } from "react";

/**
 * The changelog plate is monospace columns, so it cannot reflow: it has to be
 * written at a width that fits. Narrow viewports get fewer columns.
 */
export function usePlateWidth(wide: number, narrow: number, breakpoint = 700): number {
  const read = () =>
    typeof window === "undefined" ? wide : window.innerWidth < breakpoint ? narrow : wide;
  const [columns, setColumns] = useState(read);

  useEffect(() => {
    const onResize = () => setColumns(window.innerWidth < breakpoint ? narrow : wide);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [wide, narrow, breakpoint]);

  return columns;
}
