# QA Report

**Overall: FAIL**

| step | result |
|---|---|
| frontend npm install | pass |
| backend npm install | FAIL |
| frontend typecheck | pass |
| backend typecheck | pass |
| prisma db push | pass |
| db seed | pass |
| playwright e2e | FAIL |
| ai vision scenarios | FAIL |

E2E: 8/28 passed.

## FAIL home.spec.ts > Home page first impression > page loads and shows product name
`home.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /my local agent app/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /my local agent app/i })[22m

```

## FAIL home.spec.ts > Home page first impression > Get Started navigates to onboarding
`home.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
```

## FAIL home.spec.ts > Home page first impression > page loads and shows product name
`home.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /my local agent app/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /my local agent app/i })[22m

```

## FAIL home.spec.ts > Home page first impression > Get Started navigates to onboarding
`home.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
```

## FAIL story-001.spec.ts > STORY-001 > renders product name and primary CTA
`story-001.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /my local agent app/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /my local agent app/i })[22m

```

## FAIL story-001.spec.ts > STORY-001 > CTA navigates to onboarding route
`story-001.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
```

## FAIL story-001.spec.ts > STORY-001 > renders product name and primary CTA
`story-001.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('heading', { name: /my local agent app/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('heading', { name: /my local agent app/i })[22m

```

## FAIL story-001.spec.ts > STORY-001 > CTA navigates to onboarding route
`story-001.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
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

## FAIL story-002.spec.ts > STORY-002 > valid submission saves record and redirects to list
`story-002.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
```

## FAIL story-002.spec.ts > STORY-002 > default agent status reflects as idle after creation
`story-002.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
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

## FAIL story-002.spec.ts > STORY-002 > valid submission saves record and redirects to list
`story-002.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
```

## FAIL story-002.spec.ts > STORY-002 > default agent status reflects as idle after creation
`story-002.spec.ts`

```
[31mTest timeout of 30000ms exceeded.[39m
```

## FAIL story-003.spec.ts > STORY-003 > table renders with required column headers
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('columnheader', { name: 'name' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('columnheader', { name: 'name' })[22m

```

## FAIL story-003.spec.ts > STORY-003 > empty state displays with link when no agents exist
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/no data|empty/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByText(/no data|empty/i)[22m

```

## FAIL story-003.spec.ts > STORY-003 > deletion removes agent row without full page reload
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('row').filter({ hasText: /^Deletion Test Agent$/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: /^Deletion Test Agent$/i })[22m

```

## FAIL story-003.spec.ts > STORY-003 > table renders with required column headers
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('columnheader', { name: 'name' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('columnheader', { name: 'name' })[22m

```

## FAIL story-003.spec.ts > STORY-003 > empty state displays with link when no agents exist
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/no data|empty/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByText(/no data|empty/i)[22m

```

## FAIL story-003.spec.ts > STORY-003 > deletion removes agent row without full page reload
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('row').filter({ hasText: /^Deletion Test Agent$/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: /^Deletion Test Agent$/i })[22m

```
