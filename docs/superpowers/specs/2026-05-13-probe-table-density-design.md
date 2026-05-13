# Probe Table Density Design

## Goal

Reduce the row height of the "出口信息" table while keeping probe information complete and readable. The target is a compact two-line layout per row instead of the current multi-line block layout caused by uncontrolled wrapping in the location and ASN columns.

## Current Problem

The current table renders each cell as free-flowing text:

- The `地区` column joins country code, country, region, and city into one string, which wraps at many positions and often expands to 4-6 lines.
- The `ASN / 组织` column renders ASN and org on one line, which is acceptable for short values but does not establish a predictable vertical rhythm with the other columns.
- The row padding is already moderate; the main density issue is the text structure inside cells rather than the outer table shell.

## Chosen Approach

Keep the existing table columns and semantics, but change cell composition so each row follows a consistent two-line rhythm.

### Node Column

- Keep two lines.
- Line 1: proxy name, medium weight.
- Line 2: `proxyType / regionLabel`, muted small text.

This column already behaves close to the desired layout and only needs minor spacing tightening if needed.

### Probe IP Column

- Keep a single primary line.
- Preserve full value display for IPv4 and IPv6.
- Allow wrapping only when necessary for very long IPv6 values, but avoid adding extra decorative spacing.

This preserves completeness without turning the cell into a visual block.

### Location Column

- Replace the single concatenated location string with a structured two-line rendering.
- Line 1: `countryCode / country`
- Line 2: `region / city`
- Omit empty segments gracefully so partial probe data still renders cleanly.
- If no location fields exist, show `N/A` on one muted line.

This is the main change that reduces row height while keeping full location information visible.

### ASN / Org Column

- Render as two lines:
- Line 1: ASN
- Line 2: organization
- If one value is missing, show the other without inserting placeholder separators.
- If both are missing, show `N/A`.

This aligns the column with the same two-line rhythm as the location column and improves scanability.

### Probe Column

- Keep a single compact line for status and latency, or error text when probe failed.
- Use smaller muted text to avoid competing with the identifying columns.

## Styling Rules

- Reduce cell vertical padding slightly from the current layout, but do not rely on padding changes alone.
- Use tighter line height for muted secondary lines so two-line cells feel compact rather than stacked.
- Keep hover, border, and card styling unchanged to avoid unrelated visual churn.
- Preserve readable truncation behavior and `title` attributes where they already help expose full values.

## Out of Scope

- No change to probe row selection, sorting, or merging logic.
- No new columns, badges, or icons.
- No responsive redesign of the surrounding analysis page.
- No change to probe data formatting outside this table unless required to support the two-line cell rendering helpers.

## Implementation Notes

- `formatProbeLocation` should no longer return one joined string for the table UI; instead the table should render location parts in grouped lines.
- A small helper may be introduced to assemble the two logical location lines while ignoring missing values.
- The table should continue to show at most 12 rows as it does today.

## Acceptance Criteria

- Each populated probe row renders within a compact two-line rhythm for `节点`, `地区`, and `ASN / 组织`.
- Typical rows like `US / United States / California / Los Angeles` no longer expand to 4+ visual lines in the location column.
- Full probe information remains visible in the table without moving core fields into tooltips-only affordances.
- Long IPv6 addresses remain readable and do not break the overall layout.
- Existing probe-empty states still show `N/A` clearly.
