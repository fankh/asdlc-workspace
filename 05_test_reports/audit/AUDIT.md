# Audit — http://localhost:8088

The application’s visual layer is functionally built but suffers from foundational accessibility gaps due to dark theme token leakage and missing semantic HTML. Core console pages lack level-one headings, and specific components on the /agents route fail WCAG AA contrast requirements, risking non-compliance and reduced usability for keyboard/native screen reader users. Immediate fixes to the design system tokens and component scaffolding will restore compliance without altering business logic.

4 raw finding(s) triaged into 2 ticket(s):

| severity | area | title |
|---|---|---|
| P1 | /agents, /onboarding | Missing Page-Level <h1> Headings |
| P1 | /agents | /agents Table Contrast & Empty Header Violation |

Tickets: `01_requirements/discovered/tickets/PROBLEM-*.md` — re-run the product stage to fold them into the backlog.
