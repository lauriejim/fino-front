import type { MouseEvent } from "react";

/**
 * Primer's experimental DataTable doesn't expose `onRowClick`.
 * We emulate row-level clicks by delegating the click event on a wrapping
 * element and resolving which row was hit.
 *
 * Usage — use `onClickCapture` to beat any internal stopPropagation:
 *
 *   <Box sx={CLICKABLE_ROWS_SX} onClickCapture={(e) => {
 *     if (hasSelection()) return;
 *     const i = rowIndexFromClick(e);
 *     if (i !== null) handle(rows[i]);
 *   }}>
 *     <Table.Container>
 *       <DataTable ... />
 *     </Table.Container>
 *   </Box>
 */
export const CLICKABLE_ROWS_SX = {
  "& tbody tr, & [role='row']": { cursor: "pointer" },
  "& tbody tr:hover, & [role='row']:hover": { bg: "canvas.subtle" },
};

/**
 * Walks up from the event target and returns the index of the closest data
 * row. Handles both native `<tbody><tr>` tables and ARIA `[role="row"]`
 * layouts (some Primer versions render one, some the other).
 */
export function rowIndexFromClick(e: MouseEvent<HTMLElement>): number | null {
  const target = e.target as HTMLElement;

  // Native HTML table first
  const tr = target.closest("tbody tr");
  if (tr && tr.parentElement) {
    return Array.from(tr.parentElement.children).indexOf(tr);
  }

  // ARIA fallback: find a [role="row"] whose parent is a [role="rowgroup"]
  const roleRow = target.closest('[role="row"]');
  if (roleRow && roleRow.parentElement) {
    const siblings = Array.from(roleRow.parentElement.children).filter(
      (c) => c.getAttribute("role") === "row"
    );
    const idx = siblings.indexOf(roleRow);
    if (idx >= 0) {
      // If the first role=row is the header, skip it
      const first = siblings[0];
      const isHeader =
        first === roleRow
          ? false
          : first.querySelector("th") !== null ||
            first.getAttribute("aria-rowindex") === "1";
      return isHeader ? idx - 1 : idx;
    }
  }

  return null;
}

/** True if the user is currently selecting text — skip row-click in that case. */
export function hasSelection(): boolean {
  return !!window.getSelection()?.toString();
}

/**
 * True if the click target is inside an interactive element
 * (button / link / input / select / textarea). Use to suppress the row-click
 * when the user is actually hitting an actionable control inside a cell.
 */
export function isInteractiveClick(e: MouseEvent<HTMLElement>): boolean {
  const t = e.target as HTMLElement;
  return !!t.closest("button, a, input, select, textarea, [data-no-row-click]");
}
