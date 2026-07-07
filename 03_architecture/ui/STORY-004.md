# STORY-004 — Status Filter Dropdown & Client-Side Filtering

## Layout & Regions
| Region | Ant Component / HTML Element | Sizing & Position |
|---|---|---|
| **Page Wrapper** | `<div>` + `Layout.Content` | `padding: 32px` (Sec4), `backgroundColor: colorBgLayout` |
| **Control Bar** | `<Space align="end">` wrapping `<Select>` | Placed above table, right-aligned within content width. Gap `16px` below wrapper, `8px` between elements. |
| **Data Region** | `<Table />` | Full-width container. Header background `colorBgContainer`. Cell padding `16px` (Sec4). |

## Content Hierarchy
1. **Control Bar**: Status filter dropdown placed directly above the table body. No page titles or breadcrumbs in this zone.
2. **Table Header**: Column titles rendered via Ant `Table` `columns[].title`.
3. **Table Body**: Filtered agent rows. Status column cells use `.mono-cell` class.
4. **Empty State**: Reused from STORY-003 (`locale.emptyText`). Positioned centrally within the table wrapper when data array is empty.

## Empty / Loading / Error States
| State | Trigger | UI Pattern | Component Props |
|---|---|---|---|
| **Loading** | Initial fetch or refetch | Overlay spinner + dimmed rows | `<Table loading={isFetching} ... />` |
| **Empty** | `agents.length === 0` | Centered muted text + link to `/onboarding` | Ant `Table` `locale.emptyText` (string) |
| **Error** | HTTP ≠ 200 on mount | Banner alert above table | `<Alert type="error" message={err.message} banner action={<Button>Retry</Button>} />` |

## Exact Visible Copy
- Dropdown options: `'All'`, `'idle'`, `'active'`, `'paused'`
- Table column headers: `'name'`, `'description'`, `'status'`, `'creation date'`
- Empty state link text: `'Add agent'` (contextual reuse)

## Design Token Mapping & Implementation Notes (Sections 2–4)
| Category | Token / Value | Usage in STORY-004 |
|---|---|---|
| **Colors** | `colorBgLayout`, `colorBgContainer`, `colorBorder`, `colorTextBase`, `colorTextSecondary`, `colorPrimary`, `colorLink` | Table header bg, selected option bg (`colorPrimary`), text/body, borders for dropdown/row hover. All mapped via Ant `<ConfigProvider theme={darkTheme}>`. |
| **Typography** | System UI + Monospace (max 2 families) | Body & headers use system UI (`fontFamily: var(--ant-font-family)`). Status column uses `.mono-cell` → monospace family. Body `14px/400`, headers `h2 24px/600` / `th 18px/500`. |
| **Spacing** | `32px` page pad, `16px` control-to-table gap, `16px` table cell pad | Enforced via CSS variables or Ant `space` sizes. Strict 8pt grid compliance. No custom margins. |

**One-Pass Implementation Rules:**
- Use Ant Design `Select` with `options={[{label:'All',value:'all'},{label:'idle',value:'idle'},...]}`.
- Filter state lives in component: `const [filterStatus, setFilterStatus] = useState('all')`.
- Table data is derived client-side: `filteredAgents = agents.filter(a => filterStatus === 'all' || a.status === filterStatus)`.
- No network requests on dropdown change. Only on mount or explicit Retry click.
- All visible strings match Gherkin verbatim. No speculative components.
