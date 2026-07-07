# STORY-003 — Agent List Display, Empty State & Inline Deletion

## Layout & Regions
- **Region:** Standard B2B console data view (header row + scrollable table body)
- **Ant Components:** `Table`, `Empty`, `Button` (`type="link"` / `danger`), `Tag`

## Content Hierarchy
1. Page title: `'Agents'`
2. Data table with 4 columns
3. Empty state fallback (when count === 0)

## Exact Visible Copy
- Column Headers: `'name'`, `'description'`, `'status'`, `'creation date'`
- Status Text: `'idle'` (rendered as `Tag` with default/success styling)
- Empty State Message: `'No agents registered.'`
- Empty State Link Text: `'Create your first agent'`
- Delete Trigger Button Label: `'Delete'`

## States
- **Loading:** Table `loading={true}` (skeleton rows), disabled interactive elements
- **Empty:** `<Empty description="No agents registered." image={Empty.PRESENTED_IMAGE_SIMPLE}>` wrapping a link to `/onboarding` with visible text `'Create your first agent'`
- **Error:** Banner: `'Failed to load agents. Please refresh.'` with `reload` button
- **Data:** Row renders mapped DTO fields. Status column uses semantic tag. Creation date formatted `YYYY-MM-DD` (locale-aware).

## Accessibility
- Table uses `<thead>`/`<tbody>` semantically; header text matches Gherkin verbatim
- Delete action wrapped in `Popconfirm` (Ant Design) to prevent accidental dismissal; accessible via keyboard (Enter/Space)
- Empty state includes `aria-describedby` reference to list region
- Focus returns to table header after row removal
