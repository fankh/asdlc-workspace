import type { Lang } from './i18n';

// The manual as structured, per-language content. Keeps prose out of JSX so
// every language is a peer and adding one is trivial. Inline markup inside
// text/items (parsed by ManualPage): **bold**, `code`, [label](/route) links,
// <i>italic</i>, and <ok>/<bad>/<run> for status colours.

export type Block =
  | { k: 'p'; t: string }
  | { k: 'flow'; t: string }              // mono flow box
  | { k: 'note'; t: string }              // blue callout
  | { k: 'tip'; t: string }               // teal callout
  | { k: 'h4'; t: string }
  | { k: 'ul' | 'ol'; items: string[] }
  | { k: 'code'; code: string }
  | { k: 'faq'; qa: [string, string][] };

export interface ManualSection { id: string; title: string; blocks: Block[] }

// ---- English ---------------------------------------------------------------
const en: ManualSection[] = [
  { id: 'overview', title: 'Overview', blocks: [
    { k: 'p', t: 'This console turns registered AI **agents** into automated development workflows. You define agents, wire them into **pipelines** on a visual canvas, and let those pipelines run themselves on a **trigger** — a timer or a webhook. Everything runs locally against your own model, no cloud dependency.' },
    { k: 'flow', t: 'register agents → chain them into a pipeline → give it a trigger → it runs on its own → review in Logs & Memory → refine' },
    { k: 'note', t: 'New here? Do the [quick start](#quickstart), then copy a [recipe](#recipes) and adapt it.' },
  ] },
  { id: 'quickstart', title: '1 · Quick start', blocks: [
    { k: 'ol', items: [
      '[Register an agent](/onboarding) — name, role, persona, goal. Set its **model** to a locally-installed one (e.g. `qwen3.6`). Cloud model names (`claude-*`, `gpt-*`) fail with a clear message on a local build.',
      'Open [Agents](/agents) → **Run** → type a task → watch it execute with its persona and goal in context.',
      'On [Pipelines](/pipelines) → **New**, add a couple of nodes, wire them, and **Run**.',
      'Set the pipeline’s trigger to **Interval** or **Webhook** so it runs without you.',
    ] },
  ] },
  { id: 'agents', title: '2 · Agents', blocks: [
    { k: 'p', t: 'An agent is a reusable worker defined by its attributes. Running it sends persona + goal + your task to the model and records the result.' },
    { k: 'ul', items: [
      '**Model** — the local model that powers it (blank = default).',
      '**Context** — standing knowledge injected into <i>every</i> run: system docs, output formats, house rules. Write it once instead of repeating it per task.',
      '**Memory** — when on, the agent remembers its recent runs and recalls the most <i>relevant</i> ones on new tasks. Off by default so automations stay reproducible; only successful runs are stored.',
    ] },
    { k: 'tip', t: '**Tip:** give an agent a tight **Context** (“You review Python diffs. Reply only with a bulleted list of issues, most severe first.”) and its every run stays on-format without re-prompting.' },
  ] },
  { id: 'pipelines', title: '3 · Pipelines', blocks: [
    { k: 'p', t: 'A pipeline is a graph of nodes; each node’s output flows into the next. Node types:' },
    { k: 'ul', items: [
      '**🤖 Agent** — run a registered agent on the flowing text.',
      '**✨ Skill** — a persona-less transform: summarize, translate, extract key points, classify severity, or a custom instruction.',
      '**⑂ Logic (IF)** — branch on the text (contains / not contains / regex / longer-than). Two output ports: <ok>✓ true</ok> and <bad>✗ false</bad>. The untaken branch is marked <i>skipped</i>; the text passes through unchanged.',
      '**🌐 HTTP** — call an external URL (GET, or POST which sends `{ "input": … }`); the response becomes the flowing text. The integration escape hatch.',
    ] },
    { k: 'h4', t: 'Canvas controls' },
    { k: 'ul', items: [
      '**Add a node** — “Add node ▾” in the topbar.',
      '**Move** — drag a node. **Pan** — drag empty space. **Zoom** — mouse wheel.',
      '**Connect** — drag from a node’s right port onto another node. **Remove a connection** — click the line.',
      '**Configure** — click a node to open its settings panel.',
    ] },
    { k: 'p', t: 'Save validates the graph (exactly one start node, everything reachable, no cycles). Hit **Run** and each node colours live as it executes: <run>running</run> → <ok>succeeded</ok> / <bad>failed</bad>, untaken branches dimmed.' },
  ] },
  { id: 'triggers', title: '4 · Triggers & automation', blocks: [
    { k: 'p', t: 'The ⚡ trigger (its node docks to the start of a pipeline, or use the topbar button) is what makes development <i>automated</i>:' },
    { k: 'ul', items: [
      '**Manual** — runs only when you press Run.',
      '**Interval** — the built-in scheduler runs the pipeline’s <i>default task</i> every N seconds. It never overlaps a run that’s still going.',
      '**Webhook** — fire it with an HTTP POST from CI, cron, or any tool ([API](#api)). A disabled pipeline rejects the webhook.',
    ] },
    { k: 'p', t: 'Every run records what fired it, shown as a ⚡ tag in [Logs](/logs) and run history.' },
    { k: 'note', t: 'On a local CPU model each run can take a minute or more — keep intervals comfortably above your pipeline’s runtime. The no-overlap guard protects you, but back-to-back firing keeps the model busy.' },
  ] },
  { id: 'context', title: '5 · Context & memory', blocks: [
    { k: 'p', t: 'Three layers give agents more than a cold prompt each run:' },
    { k: 'ul', items: [
      '**Standing context** — the agent’s Context field, in every run.',
      '**Pipeline trail** — inside a chain, each step also sees the original task and a digest of earlier steps, not just the previous output.',
      '**Episodic memory** — with Memory on, summaries of the agent’s most relevant past runs are injected via vector search, so recurring workflows build on experience.',
    ] },
    { k: 'p', t: 'Turn memory on from [Agents](/agents), then run the agent — records appear in [Memory](/memory) (see [Troubleshooting](#troubleshooting) if it stays empty).' },
  ] },
  { id: 'recipes', title: '6 · Recipes', blocks: [
    { k: 'p', t: 'Concrete workflows to copy and adapt.' },
    { k: 'h4', t: 'A · Nightly service health-check & triage' },
    { k: 'p', t: 'Poll a service, branch on health, escalate only when unhealthy.' },
    { k: 'ol', items: [
      '**🌐 HTTP** GET `https://your-service/health`',
      '**⑂ Logic** — <i>contains</i> `ok`',
      '<ok>✓ true</ok> → **✨ Skill: Summarize** (a one-line “all clear”)',
      '<bad>✗ false</bad> → **🤖 Agent** “Incident Responder” — “Investigate this health output and propose the first mitigation step.”',
      '**Trigger:** Interval, e.g. every 1800s, default task `go`.',
    ] },
    { k: 'h4', t: 'B · Draft → review chain' },
    { k: 'p', t: 'Two agents refine each other’s work; the trail keeps the ask in view.' },
    { k: 'ol', items: [
      '**🤖 Agent** “Writer” — “Answer the task in two sentences.”',
      '**🤖 Agent** “Reviewer” — “Rewrite the input as one crisp, correct sentence.”',
      '**Run** with any question as the task.',
    ] },
    { k: 'h4', t: 'C · Log summarizer on a webhook' },
    { k: 'p', t: 'Let CI post logs and get back a triage.' },
    { k: 'ol', items: [
      '**✨ Skill: Extract key points** → **✨ Skill: Classify severity**',
      '**Trigger:** Webhook. Post the logs as the task:',
    ] },
    { k: 'code', code: `curl -X POST http://localhost:8088/api/hooks/<key> \\
  -H 'Content-Type: application/json' \\
  -d '{"task": "<paste log excerpt>"}'` },
  ] },
  { id: 'observability', title: '7 · Logs & memory', blocks: [
    { k: 'p', t: '[Logs](/logs) is one searchable feed of every agent and pipeline run — filter by kind or status, search task/output text, click a row for full detail.' },
    { k: 'p', t: '[Memory](/memory) shows what memory-enabled agents have stored and lets you <i>semantically search</i> the store to see exactly how recall ranks — the same mechanism the agents use.' },
  ] },
  { id: 'api', title: '8 · API reference', blocks: [
    { k: 'p', t: 'Every action has a REST endpoint under `/api` (on the hosted instance, prefixed with the app path, e.g. `/agents/api/…`). Runs are asynchronous: starting one returns immediately; poll until the status leaves `running`.' },
    { k: 'h4', t: 'Run an agent, then poll' },
    { k: 'code', code: `# start (returns 202 + the run)
curl -X POST http://localhost:8088/api/agents/<id>/runs \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'

# poll until status != "running"
curl http://localhost:8088/api/runs/<runId>` },
    { k: 'h4', t: 'Fire a pipeline by webhook' },
    { k: 'code', code: `curl -X POST http://localhost:8088/api/hooks/<webhookKey> \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'
# body optional — omit it to use the pipeline's default task` },
    { k: 'p', t: 'Get the webhook URL from a pipeline’s trigger settings (set trigger = Webhook, then Save).' },
    { k: 'h4', t: 'Search' },
    { k: 'code', code: `GET /api/logs?q=&status=&kind=      # unified run search
GET /api/memory?q=                  # semantic memory search` },
  ] },
  { id: 'troubleshooting', title: '9 · Troubleshooting', blocks: [
    { k: 'faq', qa: [
      ['A run failed with “… is a cloud model”.', 'The agent’s model is a cloud name (`claude-*`, `gpt-*`) but this is a local build. Edit the agent and set the model to a locally-installed one (e.g. `qwen3.6`).'],
      ['The Memory page is empty.', 'Two things must both be true: the agent has **Memory** on (off by default), and it has **succeeded** at a run — only successful runs are stored. Failed runs record nothing.'],
      ['A run is stuck on “running” for a while.', 'Local models are slow, especially on CPU — a task can take a minute or more. Watch it in [Logs](/logs); the page polls automatically.'],
      ['Save on the canvas says the graph is invalid.', 'A pipeline needs exactly one start node, every node reachable from it, and no cycles. Connect the nodes into a single flow.'],
      ['An agent node in a pipeline errors with “no longer exists”.', 'The agent was deleted after the pipeline was built. Open the pipeline and pick a current agent for that node.'],
      ['A webhook returns 409.', 'The pipeline is disabled. Enable it (the toggle on [Pipelines](/pipelines) or in trigger settings).'],
    ] },
  ] },
];

// ---- Korean ----------------------------------------------------------------
const ko: ManualSection[] = [
  { id: 'overview', title: '개요', blocks: [
    { k: 'p', t: '이 콘솔은 등록된 AI **에이전트**를 자동화된 개발 워크플로로 바꿉니다. 에이전트를 정의하고, 시각적 캔버스에서 **파이프라인**으로 연결한 뒤, **트리거**(타이머 또는 웹훅)로 스스로 실행되게 합니다. 모든 것이 내 모델로 로컬에서 동작하며 클라우드 의존성이 없습니다.' },
    { k: 'flow', t: '에이전트 등록 → 파이프라인으로 연결 → 트리거 지정 → 스스로 실행 → 로그·메모리에서 검토 → 개선' },
    { k: 'note', t: '처음이신가요? [빠른 시작](#quickstart)을 해보고, [레시피](#recipes)를 복사해 응용하세요.' },
  ] },
  { id: 'quickstart', title: '1 · 빠른 시작', blocks: [
    { k: 'ol', items: [
      '[에이전트 등록](/onboarding) — 이름, 역할, 페르소나, 목표. **모델**은 로컬에 설치된 것(예: `qwen3.6`)으로 설정하세요. 클라우드 모델명(`claude-*`, `gpt-*`)은 로컬 빌드에서 명확한 메시지와 함께 실패합니다.',
      '[에이전트](/agents) → **실행** → 작업 입력 → 페르소나와 목표를 컨텍스트에 담아 실행되는 모습을 확인하세요.',
      '[파이프라인](/pipelines) → **새로 만들기**에서 노드 두어 개를 추가하고 연결한 뒤 **실행**하세요.',
      '파이프라인 트리거를 **인터벌** 또는 **웹훅**으로 설정하면 사람 없이 실행됩니다.',
    ] },
  ] },
  { id: 'agents', title: '2 · 에이전트', blocks: [
    { k: 'p', t: '에이전트는 속성으로 정의되는 재사용 가능한 작업자입니다. 실행하면 페르소나 + 목표 + 작업이 모델로 전달되고 결과가 기록됩니다.' },
    { k: 'ul', items: [
      '**모델** — 이 에이전트를 구동하는 로컬 모델(비워두면 기본값).',
      '**컨텍스트** — <i>모든</i> 실행에 주입되는 상시 지식: 시스템 문서, 출력 형식, 팀 규칙. 매번 반복 설명하지 말고 한 번만 작성하세요.',
      '**메모리** — 켜면 에이전트가 최근 실행을 기억하고 새 작업에서 가장 <i>관련 있는</i> 것을 회상합니다. 재현성을 위해 기본은 꺼짐이며, 성공한 실행만 저장됩니다.',
    ] },
    { k: 'tip', t: '**팁:** 에이전트에 간결한 **컨텍스트**(“당신은 Python diff를 리뷰합니다. 문제를 심각도 높은 순으로 불릿 목록으로만 답하세요.”)를 주면 매 실행이 재요청 없이 형식을 유지합니다.' },
  ] },
  { id: 'pipelines', title: '3 · 파이프라인', blocks: [
    { k: 'p', t: '파이프라인은 노드 그래프이며, 각 노드의 출력이 다음으로 흐릅니다. 노드 종류:' },
    { k: 'ul', items: [
      '**🤖 에이전트** — 흐르는 텍스트에 대해 등록된 에이전트를 실행합니다.',
      '**✨ 스킬** — 페르소나 없는 변환: 요약, 번역, 핵심 추출, 심각도 분류, 또는 사용자 지정 지시.',
      '**⑂ 로직(IF)** — 텍스트로 분기(포함 / 미포함 / 정규식 / 길이 초과). 두 출력 포트: <ok>✓ 참</ok>과 <bad>✗ 거짓</bad>. 선택되지 않은 분기는 <i>건너뜀</i>으로 표시되고 텍스트는 그대로 통과합니다.',
      '**🌐 HTTP** — 외부 URL 호출(GET, 또는 `{ "input": … }`를 보내는 POST); 응답이 흐르는 텍스트가 됩니다. 통합용 탈출구.',
    ] },
    { k: 'h4', t: '캔버스 조작' },
    { k: 'ul', items: [
      '**노드 추가** — 상단바의 “Add node ▾”.',
      '**이동** — 노드를 드래그. **패닝** — 빈 공간 드래그. **확대/축소** — 마우스 휠.',
      '**연결** — 노드의 오른쪽 포트에서 다른 노드로 드래그. **연결 제거** — 선을 클릭.',
      '**설정** — 노드를 클릭하면 설정 패널이 열립니다.',
    ] },
    { k: 'p', t: '저장 시 그래프를 검증합니다(시작 노드는 정확히 하나, 모두 도달 가능, 순환 없음). **실행**하면 각 노드가 실시간으로 색이 바뀝니다: <run>실행 중</run> → <ok>성공</ok> / <bad>실패</bad>, 선택되지 않은 분기는 흐려집니다.' },
  ] },
  { id: 'triggers', title: '4 · 트리거 & 자동화', blocks: [
    { k: 'p', t: '⚡ 트리거(노드가 파이프라인 시작 지점에 붙거나 상단바 버튼 사용)가 개발을 <i>자동화</i>로 만듭니다:' },
    { k: 'ul', items: [
      '**수동** — 실행 버튼을 눌러야만 실행됩니다.',
      '**인터벌** — 내장 스케줄러가 파이프라인의 <i>기본 작업</i>을 N초마다 실행합니다. 진행 중인 실행과 절대 겹치지 않습니다.',
      '**웹훅** — CI, cron, 또는 어떤 도구로든 HTTP POST로 실행([API](#api)). 비활성 파이프라인은 웹훅을 거부합니다.',
    ] },
    { k: 'p', t: '모든 실행은 무엇이 실행시켰는지 기록하며, [로그](/logs)와 실행 기록에 ⚡ 태그로 표시됩니다.' },
    { k: 'note', t: '로컬 CPU 모델에서는 실행마다 1분 이상 걸릴 수 있으니 인터벌을 파이프라인 실행 시간보다 넉넉히 크게 두세요. 비겹침 보호장치가 있지만 연속 실행은 모델을 계속 바쁘게 만듭니다.' },
  ] },
  { id: 'context', title: '5 · 컨텍스트 & 메모리', blocks: [
    { k: 'p', t: '세 계층이 매 실행에서 에이전트에 단순 프롬프트 이상을 제공합니다:' },
    { k: 'ul', items: [
      '**상시 컨텍스트** — 에이전트의 컨텍스트 필드, 모든 실행에 포함.',
      '**파이프라인 트레일** — 체인 내에서 각 단계는 직전 출력뿐 아니라 원래 작업과 이전 단계 요약도 함께 봅니다.',
      '**에피소드 메모리** — 메모리를 켜면 벡터 검색으로 가장 관련 있는 과거 실행 요약이 주입되어, 반복 워크플로가 경험 위에 쌓입니다.',
    ] },
    { k: 'p', t: '[에이전트](/agents)에서 메모리를 켜고 실행하면 [메모리](/memory)에 기록이 나타납니다(비어 있으면 [문제 해결](#troubleshooting) 참고).' },
  ] },
  { id: 'recipes', title: '6 · 레시피', blocks: [
    { k: 'p', t: '복사해 응용할 구체적 워크플로.' },
    { k: 'h4', t: 'A · 야간 서비스 헬스체크 & 트리아지' },
    { k: 'p', t: '서비스를 폴링하고 상태로 분기하여, 비정상일 때만 에스컬레이션.' },
    { k: 'ol', items: [
      '**🌐 HTTP** GET `https://your-service/health`',
      '**⑂ 로직** — <i>포함</i> `ok`',
      '<ok>✓ 참</ok> → **✨ 스킬: 요약** (한 줄 “이상 없음”)',
      '<bad>✗ 거짓</bad> → **🤖 에이전트** “인시던트 대응자” — “이 헬스 출력을 조사하고 첫 완화 조치를 제안하세요.”',
      '**트리거:** 인터벌, 예: 1800초마다, 기본 작업 `go`.',
    ] },
    { k: 'h4', t: 'B · 초안 → 검토 체인' },
    { k: 'p', t: '두 에이전트가 서로의 결과를 다듬고, 트레일이 요청을 유지합니다.' },
    { k: 'ol', items: [
      '**🤖 에이전트** “작성자” — “작업을 두 문장으로 답하세요.”',
      '**🤖 에이전트** “검토자” — “입력을 하나의 간결하고 정확한 문장으로 다시 쓰세요.”',
      '아무 질문이나 작업으로 **실행**하세요.',
    ] },
    { k: 'h4', t: 'C · 웹훅 기반 로그 요약기' },
    { k: 'p', t: 'CI가 로그를 보내면 트리아지를 돌려받습니다.' },
    { k: 'ol', items: [
      '**✨ 스킬: 핵심 추출** → **✨ 스킬: 심각도 분류**',
      '**트리거:** 웹훅. 로그를 작업으로 전송:',
    ] },
    { k: 'code', code: `curl -X POST http://localhost:8088/api/hooks/<key> \\
  -H 'Content-Type: application/json' \\
  -d '{"task": "<paste log excerpt>"}'` },
  ] },
  { id: 'observability', title: '7 · 로그 & 메모리', blocks: [
    { k: 'p', t: '[로그](/logs)는 모든 에이전트·파이프라인 실행의 검색 가능한 피드입니다 — 종류나 상태로 필터, 작업/출력 텍스트 검색, 행 클릭으로 상세 보기.' },
    { k: 'p', t: '[메모리](/memory)는 메모리가 켜진 에이전트가 저장한 내용을 보여주고, 저장소를 <i>시맨틱 검색</i>하여 회상 순위를 그대로 확인하게 합니다 — 에이전트가 쓰는 것과 동일한 방식.' },
  ] },
  { id: 'api', title: '8 · API 레퍼런스', blocks: [
    { k: 'p', t: '모든 동작에는 `/api` 아래 REST 엔드포인트가 있습니다(호스팅 인스턴스에서는 앱 경로가 앞에 붙음, 예: `/agents/api/…`). 실행은 비동기입니다: 시작하면 즉시 반환되고, 상태가 `running`을 벗어날 때까지 폴링하세요.' },
    { k: 'h4', t: '에이전트 실행 후 폴링' },
    { k: 'code', code: `# start (returns 202 + the run)
curl -X POST http://localhost:8088/api/agents/<id>/runs \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'

# poll until status != "running"
curl http://localhost:8088/api/runs/<runId>` },
    { k: 'h4', t: '웹훅으로 파이프라인 실행' },
    { k: 'code', code: `curl -X POST http://localhost:8088/api/hooks/<webhookKey> \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'
# body optional — omit it to use the pipeline's default task` },
    { k: 'p', t: '웹훅 URL은 파이프라인 트리거 설정에서 얻으세요(트리거 = 웹훅으로 설정 후 저장).' },
    { k: 'h4', t: '검색' },
    { k: 'code', code: `GET /api/logs?q=&status=&kind=      # unified run search
GET /api/memory?q=                  # semantic memory search` },
  ] },
  { id: 'troubleshooting', title: '9 · 문제 해결', blocks: [
    { k: 'faq', qa: [
      ['실행이 “… is a cloud model”로 실패합니다.', '에이전트 모델이 클라우드 이름(`claude-*`, `gpt-*`)인데 이건 로컬 빌드입니다. 에이전트를 편집해 로컬에 설치된 모델(예: `qwen3.6`)로 설정하세요.'],
      ['메모리 페이지가 비어 있습니다.', '두 조건이 모두 참이어야 합니다: 에이전트의 **메모리**가 켜져 있고(기본은 꺼짐), 실행이 **성공**했어야 합니다 — 성공한 실행만 저장됩니다. 실패한 실행은 아무것도 기록하지 않습니다.'],
      ['실행이 한동안 “실행 중”에 멈춰 있습니다.', '로컬 모델은 특히 CPU에서 느립니다 — 작업이 1분 이상 걸릴 수 있습니다. [로그](/logs)에서 지켜보세요. 페이지가 자동으로 폴링합니다.'],
      ['캔버스 저장이 그래프가 유효하지 않다고 합니다.', '파이프라인은 시작 노드가 정확히 하나, 모든 노드가 거기서 도달 가능, 순환이 없어야 합니다. 노드를 하나의 흐름으로 연결하세요.'],
      ['파이프라인의 에이전트 노드가 “no longer exists”로 오류가 납니다.', '파이프라인 생성 후 에이전트가 삭제된 것입니다. 파이프라인을 열어 해당 노드에 현재 에이전트를 선택하세요.'],
      ['웹훅이 409를 반환합니다.', '파이프라인이 비활성 상태입니다. 활성화하세요([파이프라인](/pipelines)의 토글 또는 트리거 설정에서).'],
    ] },
  ] },
];

// ---- Japanese --------------------------------------------------------------
const ja: ManualSection[] = [
  { id: 'overview', title: '概要', blocks: [
    { k: 'p', t: 'このコンソールは登録した AI **エージェント**を自動化された開発ワークフローに変えます。エージェントを定義し、ビジュアルキャンバス上で**パイプライン**に接続し、**トリガー**（タイマーまたはウェブフック）で自動実行させます。すべてローカルの自分のモデルで動作し、クラウド依存はありません。' },
    { k: 'flow', t: 'エージェント登録 → パイプラインに接続 → トリガー設定 → 自動実行 → ログ・メモリで確認 → 改善' },
    { k: 'note', t: '初めてですか？[クイックスタート](#quickstart)を試し、[レシピ](#recipes)をコピーして応用してください。' },
  ] },
  { id: 'quickstart', title: '1 · クイックスタート', blocks: [
    { k: 'ol', items: [
      '[エージェント登録](/onboarding) — 名前・役割・ペルソナ・目標。**モデル**はローカルにインストール済みのもの（例: `qwen3.6`）を設定してください。クラウドモデル名（`claude-*`、`gpt-*`）はローカルビルドでは明確なメッセージとともに失敗します。',
      '[エージェント](/agents) → **実行** → タスクを入力 → ペルソナと目標をコンテキストに含めて実行される様子を確認。',
      '[パイプライン](/pipelines) → **新規** で、ノードをいくつか追加して接続し、**実行**します。',
      'パイプラインのトリガーを **インターバル** または **ウェブフック** に設定すると、手を離しても実行されます。',
    ] },
  ] },
  { id: 'agents', title: '2 · エージェント', blocks: [
    { k: 'p', t: 'エージェントは属性で定義される再利用可能なワーカーです。実行すると、ペルソナ＋目標＋タスクがモデルに送られ、結果が記録されます。' },
    { k: 'ul', items: [
      '**モデル** — このエージェントを動かすローカルモデル（空欄＝既定）。',
      '**コンテキスト** — <i>すべての</i>実行に注入される常設知識：システム文書、出力フォーマット、チームのルール。毎回説明せず一度だけ書きます。',
      '**メモリ** — オンにするとエージェントは最近の実行を記憶し、新しいタスクで最も<i>関連する</i>ものを想起します。再現性のため既定はオフで、成功した実行のみ保存されます。',
    ] },
    { k: 'tip', t: '**ヒント：** エージェントに簡潔な**コンテキスト**（「あなたは Python の差分をレビューします。問題を深刻度の高い順に箇条書きのみで答えてください。」）を与えると、毎回の実行が再指示なしでフォーマットを保ちます。' },
  ] },
  { id: 'pipelines', title: '3 · パイプライン', blocks: [
    { k: 'p', t: 'パイプラインはノードのグラフで、各ノードの出力が次に流れます。ノードの種類：' },
    { k: 'ul', items: [
      '**🤖 エージェント** — 流れるテキストに対して登録済みエージェントを実行。',
      '**✨ スキル** — ペルソナ不要の変換：要約、翻訳、要点抽出、深刻度分類、またはカスタム指示。',
      '**⑂ ロジック（IF）** — テキストで分岐（含む／含まない／正規表現／長さ超過）。2つの出力ポート：<ok>✓ 真</ok> と <bad>✗ 偽</bad>。選ばれなかった分岐は<i>スキップ</i>と表示され、テキストはそのまま通過します。',
      '**🌐 HTTP** — 外部 URL を呼び出し（GET、または `{ "input": … }` を送る POST）。応答が流れるテキストになります。連携の抜け道。',
    ] },
    { k: 'h4', t: 'キャンバス操作' },
    { k: 'ul', items: [
      '**ノード追加** — 上部バーの「Add node ▾」。',
      '**移動** — ノードをドラッグ。**パン** — 空白をドラッグ。**ズーム** — マウスホイール。',
      '**接続** — ノードの右ポートから別のノードへドラッグ。**接続を削除** — 線をクリック。',
      '**設定** — ノードをクリックすると設定パネルが開きます。',
    ] },
    { k: 'p', t: '保存時にグラフを検証します（開始ノードは正確に1つ、すべて到達可能、循環なし）。**実行**すると各ノードがライブで色付きます：<run>実行中</run> → <ok>成功</ok> / <bad>失敗</bad>、選ばれなかった分岐は暗くなります。' },
  ] },
  { id: 'triggers', title: '4 · トリガーと自動化', blocks: [
    { k: 'p', t: '⚡ トリガー（ノードがパイプライン開始点に接続、または上部バーのボタン）が開発を<i>自動化</i>にします：' },
    { k: 'ul', items: [
      '**手動** — 実行ボタンを押したときのみ実行。',
      '**インターバル** — 内蔵スケジューラがパイプラインの<i>既定タスク</i>を N 秒ごとに実行。進行中の実行と決して重なりません。',
      '**ウェブフック** — CI、cron、任意のツールから HTTP POST で実行（[API](#api)）。無効なパイプラインはウェブフックを拒否します。',
    ] },
    { k: 'p', t: 'すべての実行は何が起動したかを記録し、[ログ](/logs)と実行履歴に ⚡ タグで表示されます。' },
    { k: 'note', t: 'ローカル CPU モデルでは1回の実行に1分以上かかることがあるため、インターバルはパイプラインの実行時間より十分大きくしてください。非重複ガードが守りますが、連続実行はモデルを常に稼働させます。' },
  ] },
  { id: 'context', title: '5 · コンテキストとメモリ', blocks: [
    { k: 'p', t: '3つの層が毎回の実行でエージェントに単なるプロンプト以上を与えます：' },
    { k: 'ul', items: [
      '**常設コンテキスト** — エージェントのコンテキスト欄、すべての実行に含まれます。',
      '**パイプライントレイル** — チェーン内で各ステップは直前の出力だけでなく、元のタスクと以前のステップの要約も参照します。',
      '**エピソードメモリ** — メモリをオンにすると、ベクトル検索で最も関連する過去の実行の要約が注入され、繰り返しのワークフローが経験の上に積み上がります。',
    ] },
    { k: 'p', t: '[エージェント](/agents)でメモリをオンにして実行すると、[メモリ](/memory)に記録が現れます（空のままなら[トラブルシューティング](#troubleshooting)を参照）。' },
  ] },
  { id: 'recipes', title: '6 · レシピ', blocks: [
    { k: 'p', t: 'コピーして応用できる具体的なワークフロー。' },
    { k: 'h4', t: 'A · 夜間サービスのヘルスチェックとトリアージ' },
    { k: 'p', t: 'サービスをポーリングし、状態で分岐して、異常時のみエスカレーション。' },
    { k: 'ol', items: [
      '**🌐 HTTP** GET `https://your-service/health`',
      '**⑂ ロジック** — <i>含む</i> `ok`',
      '<ok>✓ 真</ok> → **✨ スキル：要約**（1行「異常なし」）',
      '<bad>✗ 偽</bad> → **🤖 エージェント**「インシデント対応者」 — 「このヘルス出力を調査し、最初の緩和策を提案してください。」',
      '**トリガー：** インターバル、例：1800秒ごと、既定タスク `go`。',
    ] },
    { k: 'h4', t: 'B · 下書き → レビューのチェーン' },
    { k: 'p', t: '2つのエージェントが互いの成果を磨き、トレイルが依頼を保持します。' },
    { k: 'ol', items: [
      '**🤖 エージェント**「ライター」 — 「タスクに2文で答えてください。」',
      '**🤖 エージェント**「レビュアー」 — 「入力を簡潔で正確な1文に書き直してください。」',
      '任意の質問をタスクとして**実行**します。',
    ] },
    { k: 'h4', t: 'C · ウェブフックでのログ要約' },
    { k: 'p', t: 'CI にログを投稿させ、トリアージを受け取ります。' },
    { k: 'ol', items: [
      '**✨ スキル：要点抽出** → **✨ スキル：深刻度分類**',
      '**トリガー：** ウェブフック。ログをタスクとして送信：',
    ] },
    { k: 'code', code: `curl -X POST http://localhost:8088/api/hooks/<key> \\
  -H 'Content-Type: application/json' \\
  -d '{"task": "<paste log excerpt>"}'` },
  ] },
  { id: 'observability', title: '7 · ログとメモリ', blocks: [
    { k: 'p', t: '[ログ](/logs)はすべてのエージェント・パイプライン実行を検索できるフィードです — 種別や状態で絞り込み、タスク／出力テキストを検索、行をクリックで詳細表示。' },
    { k: 'p', t: '[メモリ](/memory)はメモリを有効にしたエージェントが保存した内容を表示し、ストアを<i>セマンティック検索</i>して想起の順位をそのまま確認できます — エージェントが使うのと同じ仕組みです。' },
  ] },
  { id: 'api', title: '8 · API リファレンス', blocks: [
    { k: 'p', t: 'すべての操作に `/api` 配下の REST エンドポイントがあります（ホスト版ではアプリのパスが前に付きます。例：`/agents/api/…`）。実行は非同期です：開始すると即座に返り、状態が `running` を外れるまでポーリングします。' },
    { k: 'h4', t: 'エージェントを実行してポーリング' },
    { k: 'code', code: `# start (returns 202 + the run)
curl -X POST http://localhost:8088/api/agents/<id>/runs \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'

# poll until status != "running"
curl http://localhost:8088/api/runs/<runId>` },
    { k: 'h4', t: 'ウェブフックでパイプラインを実行' },
    { k: 'code', code: `curl -X POST http://localhost:8088/api/hooks/<webhookKey> \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'
# body optional — omit it to use the pipeline's default task` },
    { k: 'p', t: 'ウェブフック URL はパイプラインのトリガー設定から取得します（トリガー＝ウェブフックに設定して保存）。' },
    { k: 'h4', t: '検索' },
    { k: 'code', code: `GET /api/logs?q=&status=&kind=      # unified run search
GET /api/memory?q=                  # semantic memory search` },
  ] },
  { id: 'troubleshooting', title: '9 · トラブルシューティング', blocks: [
    { k: 'faq', qa: [
      ['実行が「… is a cloud model」で失敗する。', 'エージェントのモデルがクラウド名（`claude-*`、`gpt-*`）ですが、これはローカルビルドです。エージェントを編集し、ローカルにインストール済みのモデル（例：`qwen3.6`）に設定してください。'],
      ['メモリページが空です。', '2つの条件がともに真である必要があります：エージェントの**メモリ**がオン（既定はオフ）で、実行が**成功**したこと — 成功した実行のみ保存されます。失敗した実行は何も記録しません。'],
      ['実行がしばらく「実行中」のままです。', 'ローカルモデルは特に CPU で低速です — タスクに1分以上かかることがあります。[ログ](/logs)で見守ってください。ページは自動でポーリングします。'],
      ['キャンバスの保存でグラフが無効と表示される。', 'パイプラインは開始ノードが正確に1つ、すべてのノードがそこから到達可能、循環なしである必要があります。ノードを1つの流れに接続してください。'],
      ['パイプラインのエージェントノードが「no longer exists」でエラーになる。', 'パイプライン作成後にエージェントが削除されています。パイプラインを開き、そのノードに現在のエージェントを選んでください。'],
      ['ウェブフックが 409 を返す。', 'パイプラインが無効です。有効化してください（[パイプライン](/pipelines)のトグル、またはトリガー設定で）。'],
    ] },
  ] },
];

export const MANUAL: Record<Lang, ManualSection[]> = { en, ko, ja };
