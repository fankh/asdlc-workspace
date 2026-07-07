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
| ai vision scenarios | FAIL |

E2E: 10/28 passed.

## FAIL home.spec.ts > Home page first impression > page is accessible (no serious axe violations)
`home.spec.ts`

```
Error: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#1677ff",
              "contrastRatio": 4.1,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button aria-label=\"Get Started\" type=\"button\" class=\"ant-btn css-dev-only-do-not-override-mncuj7 ant-btn-primary ant-btn-color-primary ant-btn-variant-solid\"><span>Get Started</span></button>",
                "target": [
                  "button"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span>Get Started</span>",
        "target": [
          "span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
 
```

## FAIL home.spec.ts > Home page first impression > page is accessible (no serious axe violations)
`home.spec.ts`

```
Error: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#1677ff",
              "contrastRatio": 4.1,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button aria-label=\"Get Started\" type=\"button\" class=\"ant-btn css-dev-only-do-not-override-mncuj7 ant-btn-primary ant-btn-color-primary ant-btn-variant-solid\"><span>Get Started</span></button>",
                "target": [
                  "button"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span>Get Started</span>",
        "target": [
          "span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
 
```

## FAIL story-001.spec.ts > STORY-001 > accessibility compliance on landing page
`story-001.spec.ts`

```
Error: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#1677ff",
              "contrastRatio": 4.1,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button aria-label=\"Get Started\" type=\"button\" class=\"ant-btn css-dev-only-do-not-override-mncuj7 ant-btn-primary ant-btn-color-primary ant-btn-variant-solid\"><span>Get Started</span></button>",
                "target": [
                  "button"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span>Get Started</span>",
        "target": [
          "span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
 
```

## FAIL story-001.spec.ts > STORY-001 > accessibility compliance on landing page
`story-001.spec.ts`

```
Error: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#1677ff",
              "contrastRatio": 4.1,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button aria-label=\"Get Started\" type=\"button\" class=\"ant-btn css-dev-only-do-not-override-mncuj7 ant-btn-primary ant-btn-color-primary ant-btn-variant-solid\"><span>Get Started</span></button>",
                "target": [
                  "button"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span>Get Started</span>",
        "target": [
          "span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
 
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
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('row').filter({ hasText: /^Test Agent 1783417873544$/i }).getByRole('cell')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: /^Test Agent 1783417873544$/i }).getByRole('cell')[22m

```

## FAIL story-002.spec.ts > STORY-002 > default agent status reflects as idle after creation
`story-002.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: getByRole('row').filter({ hasText: /^Idle Status Agent 1783417873636$/i }).getByRole('cell').nth(2)
Expected pattern: [32m/idle/i[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toHaveText" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: /^Idle Status Agent 1783417873636$/i }).getByRole('cell').nth(2)[22m

```

## FAIL story-002.spec.ts > STORY-002 > accessibility compliance on onboarding page
`story-002.spec.ts`

```
Error: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#1677ff",
              "contrastRatio": 4.1,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button type=\"submit\" class=\"ant-btn css-dev-only-do-not-override-mncuj7 ant-btn-primary ant-btn-color-primary ant-btn-variant-solid\"><span>Create Agent</span></button>",
                "target": [
                  "button"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span>Create Agent</span>",
        "target": [
          "span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

[2me
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
Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeTruthy[2m()[22m

Received: [31mfalse[39m
```

## FAIL story-002.spec.ts > STORY-002 > default agent status reflects as idle after creation
`story-002.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: getByRole('row').filter({ hasText: /^Idle Status Agent 1783417875010$/i }).getByRole('cell').nth(2)
Expected pattern: [32m/idle/i[39m
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toHaveText" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: /^Idle Status Agent 1783417875010$/i }).getByRole('cell').nth(2)[22m

```

## FAIL story-002.spec.ts > STORY-002 > accessibility compliance on onboarding page
`story-002.spec.ts`

```
Error: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#ffffff",
              "bgColor": "#1677ff",
              "contrastRatio": 4.1,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [
              {
                "html": "<button type=\"submit\" class=\"ant-btn css-dev-only-do-not-override-mncuj7 ant-btn-primary ant-btn-color-primary ant-btn-variant-solid\"><span>Create Agent</span></button>",
                "target": [
                  "button"
                ]
              }
            ],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<span>Create Agent</span>",
        "target": [
          "span"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 4.1 (foreground color: #ffffff, background color: #1677ff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      }
    ]
  }
]

[2me
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

Locator: getByRole('row').filter({ hasText: /^Idle Status Agent 1783417873636$/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('row').filter({ hasText: /^Idle Status Agent 1783417873636$/i })[22m

```

## FAIL story-003.spec.ts > STORY-003 > table renders with required column headers
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByRole('columnheader', { name: 'description' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
[2m  - Expect "toBeVisible" with timeout 5000ms[22m
[2m  - waiting for getByRole('columnheader', { name: 'description' })[22m

```

## FAIL story-003.spec.ts > STORY-003 > empty state displays with link when no agents exist
`story-003.spec.ts`

```
Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/no data|empty/i)
Expected: visible
Error: strict mode violation: getByText(/no data|empty/i) resolved to 2 elements:
    1) <title>No data</title> aka getByRole('img', { name: 'No data' }).locator('title')
    2) <div class="ant-empty-description">No data</div> aka getByText('No data').nth(1)

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

## FAIL story-003.spec.ts > STORY-003 > accessibility compliance on agents list page
`story-003.spec.ts`

```
Error: [
  {
    "id": "color-contrast",
    "impact": "serious",
    "tags": [
      "cat.color",
      "wcag2aa",
      "wcag143",
      "TTv5",
      "TT13.c",
      "EN-301-549",
      "EN-9.1.4.3",
      "ACT",
      "RGAAv4",
      "RGAA-3.2.1"
    ],
    "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
    "help": "Elements must meet minimum color contrast ratio thresholds",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
    "nodes": [
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#8c8c8c",
              "bgColor": "#ffffff",
              "contrastRatio": 3.36,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "normal",
              "messageKey": null,
              "expectedContrastRatio": "4.5:1"
            },
            "relatedNodes": [],
            "impact": "serious",
            "message": "Element has insufficient color contrast of 3.36 (foreground color: #8c8c8c, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
          }
        ],
        "all": [],
        "none": [],
        "impact": "serious",
        "html": "<div class=\"ant-empty-description\">No data available</div>",
        "target": [
          ".ant-empty-description"
        ],
        "failureSummary": "Fix any of the following:\n  Element has insufficient color contrast of 3.36 (foreground color: #8c8c8c, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1"
      },
      {
        "any": [
          {
            "id": "color-contrast",
            "data": {
              "fgColor": "#1677ff",
              "bgColor": "#ffffff",
              "contrastRatio": 4.1,
              "fontSize": "10.5pt (14px)",
              "fontWeight": "norm
```
