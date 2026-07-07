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

E2E: 22/34 passed.

## FAIL story-002.spec.ts > STORY-002 > displays welcome message and form fields
`story-002.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /welcome/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /welcome/i })[22m

```

## FAIL story-002.spec.ts > STORY-002 > displays welcome message and form fields
`story-002.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /welcome/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /welcome/i })[22m

```

## FAIL story-003.spec.ts > STORY-003 > empty state displays with link when no agents exist
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('link', { name: /onboarding|add agent/i }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('link', { name: /onboarding|add agent/i }).first()[22m

```

## FAIL story-003.spec.ts > STORY-003 > deletion removes agent row without full page reload
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).not.[22mtoBeVisible[2m([22m[2m)[22m failed

Locator:  getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424637381' })
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
[2m  - Expect "not toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424637381' })[22m
[2m    14 × locator resolved to <tr class="ant-table-row ant-table-row-level-0" data-row-key="5a251d14-8166-4d00-9e49-980ddbecfc2a">…</tr>[22m
[2m       - unexpected value "visible"[22m

```

## FAIL story-003.spec.ts > STORY-003 > empty state displays with link when no agents exist
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('link', { name: /onboarding|add agent/i }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('link', { name: /onboarding|add agent/i }).first()[22m

```

## FAIL story-003.spec.ts > STORY-003 > deletion removes agent row without full page reload
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).not.[22mtoBeVisible[2m([22m[2m)[22m failed

Locator:  getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424662147' })
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
[2m  - Expect "not toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: 'Deletion Test Agent 1783424662147' })[22m
[2m    14 × locator resolved to <tr class="ant-table-row ant-table-row-level-0" data-row-key="a5668350-53d8-4f6f-b9a1-cab80d156c3c">…</tr>[22m
[2m       - unexpected value "visible"[22m

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
