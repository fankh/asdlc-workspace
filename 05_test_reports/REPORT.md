# QA Report

**Overall: FAIL**

| step | result |
|---|---|
| frontend npm install | pass |
| backend npm install | pass |
| frontend typecheck | pass |
| backend typecheck | pass |
| prisma db push | pass |
| db seed | pass |
| playwright e2e | FAIL |
| ai vision scenarios | pass |

E2E: 18/34 passed.

## FAIL home.spec.ts > Home page first impression > Get Started navigates to onboarding
`home.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /onboarding/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /onboarding/i })[22m

```

## FAIL home.spec.ts > Home page first impression > Get Started navigates to onboarding
`home.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /onboarding/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /onboarding/i })[22m

```

## FAIL story-001.spec.ts > STORY-001 > CTA navigates to onboarding route
`story-001.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /onboarding/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /onboarding/i })[22m

```

## FAIL story-001.spec.ts > STORY-001 > CTA navigates to onboarding route
`story-001.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /onboarding/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /onboarding/i })[22m

```

## FAIL story-003.spec.ts > STORY-003 > empty state displays with link when no agents exist
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/no data available/i).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByText(/no data available/i).first()[22m

```

## FAIL story-003.spec.ts > STORY-003 > deletion removes agent row without full page reload
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).not.[22mtoBeVisible[2m([22m[2m)[22m failed

Locator:  getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424226694' })
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
[2m  - Expect "not toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424226694' })[22m
[2m    14 × locator resolved to <tr class="ant-table-row ant-table-row-level-0" data-row-key="0a31bc81-9f9b-4340-94a7-c372ba2ec8a8">…</tr>[22m
[2m       - unexpected value "visible"[22m

```

## FAIL story-003.spec.ts > STORY-003 > accessibility compliance on agents list page
`story-003.spec.ts`

```
Error: [
  {
    "id": "label",
    "impact": "critical",
    "tags": [
      "cat.forms",
      "wcag2a",
      "wcag412",
      "section508",
      "section508.22.n",
      "TTv5",
      "TT5.c",
      "EN-301-549",
      "EN-9.4.1.2",
      "ACT",
      "RGAAv4",
      "RGAA-11.1.1"
    ],
    "description": "Ensure every form element has a label",
    "help": "Form elements must have labels",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/label?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "implicit-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element does not have an implicit (wrapped) <label>"
          },
          {
            "id": "explicit-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element does not have an explicit <label>"
          },
          {
            "id": "aria-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "aria-label attribute does not exist or is empty"
          },
          {
            "id": "aria-labelledby",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty"
          },
          {
            "id": "non-empty-title",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element has no title attribute"
          },
          {
            "id": "non-empty-placeholder",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element has no placehold
```

## FAIL story-003.spec.ts > STORY-003 > empty state displays with link when no agents exist
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/no data available/i).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByText(/no data available/i).first()[22m

```

## FAIL story-003.spec.ts > STORY-003 > deletion removes agent row without full page reload
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).not.[22mtoBeVisible[2m([22m[2m)[22m failed

Locator:  getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424257597' })
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
[2m  - Expect "not toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424257597' })[22m
[2m    14 × locator resolved to <tr class="ant-table-row ant-table-row-level-0" data-row-key="69580b20-d4fa-4d58-a131-54a62f91c291">…</tr>[22m
[2m       - unexpected value "visible"[22m

```

## FAIL story-003.spec.ts > STORY-003 > accessibility compliance on agents list page
`story-003.spec.ts`

```
Error: [
  {
    "id": "label",
    "impact": "critical",
    "tags": [
      "cat.forms",
      "wcag2a",
      "wcag412",
      "section508",
      "section508.22.n",
      "TTv5",
      "TT5.c",
      "EN-301-549",
      "EN-9.4.1.2",
      "ACT",
      "RGAAv4",
      "RGAA-11.1.1"
    ],
    "description": "Ensure every form element has a label",
    "help": "Form elements must have labels",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/label?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "implicit-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element does not have an implicit (wrapped) <label>"
          },
          {
            "id": "explicit-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element does not have an explicit <label>"
          },
          {
            "id": "aria-label",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "aria-label attribute does not exist or is empty"
          },
          {
            "id": "aria-labelledby",
            "data": null,
            "relatedNodes": [],
            "impact": "critical",
            "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty"
          },
          {
            "id": "non-empty-title",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element has no title attribute"
          },
          {
            "id": "non-empty-placeholder",
            "data": {
              "messageKey": "noAttr"
            },
            "relatedNodes": [],
            "impact": "critical",
            "message": "Element has no placehold
```

## FAIL story-004.spec.ts > STORY-004: Status Filter Dropdown & Client-Side Filtering > renders status filter dropdown with required options
`story-004.spec.ts`

```
Error: "context" and "page" fixtures are not supported in "beforeAll" since they are created on a per-test basis.
If you would like to reuse a single page between tests, create context manually with browser.newContext(). See https://aka.ms/playwright/reuse-page for details.
If you would like to configure your page before each test, do that in beforeEach hook instead.
```

## FAIL story-004.spec.ts > STORY-004: Status Filter Dropdown & Client-Side Filtering > filters agent list by selected status without page reload
`story-004.spec.ts`

```

```

## FAIL story-004.spec.ts > STORY-004: Status Filter Dropdown & Client-Side Filtering > is accessible (no serious axe violations)
`story-004.spec.ts`

```

```

## FAIL story-004.spec.ts > STORY-004: Status Filter Dropdown & Client-Side Filtering > renders status filter dropdown with required options
`story-004.spec.ts`

```
Error: "context" and "page" fixtures are not supported in "beforeAll" since they are created on a per-test basis.
If you would like to reuse a single page between tests, create context manually with browser.newContext(). See https://aka.ms/playwright/reuse-page for details.
If you would like to configure your page before each test, do that in beforeEach hook instead.
```

## FAIL story-004.spec.ts > STORY-004: Status Filter Dropdown & Client-Side Filtering > filters agent list by selected status without page reload
`story-004.spec.ts`

```

```

## FAIL story-004.spec.ts > STORY-004: Status Filter Dropdown & Client-Side Filtering > is accessible (no serious axe violations)
`story-004.spec.ts`

```

```
