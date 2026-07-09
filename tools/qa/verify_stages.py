# Stage-artifact verifier for ASDLC pipeline runs.
#
# Audits a workspace after (or during) a run for:
#   A. log/state consistency  — log lines vs state.json vs .status_done markers
#                               vs auto-commits, monotonic timestamps, errors
#   B. plan vs requirements   — backlog covers the brief's stories and domain
#                               anchors, Gherkin ACs, no scope creep
#   C. design/architecture    — story coverage, OpenAPI parses and covers the
#                               domain, cross-file anchor consistency
#   D. documentation quality  — no placeholders, no previous-project leakage,
#                               correct project name
#
# Usage:
#   python tools/qa/verify_stages.py --root C:/path/to/workspace \
#       [--log run-output.txt] [--anchors P1,P2,...] [--forbidden auth,...]

import argparse
import io
import json
import re
import subprocess
import sys
from pathlib import Path

PASS, FAIL, WARN = [], [], []


def check(name, cond, detail=''):
    (PASS if cond else FAIL).append(f'{name}' + (f' -- {detail}' if detail and not cond else ''))


def warn(name, detail=''):
    WARN.append(f'{name}' + (f' -- {detail}' if detail else ''))


def read(p: Path) -> str:
    try:
        return io.open(p, encoding='utf-8', errors='replace').read()
    except OSError:
        return ''


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True)
    ap.add_argument('--log', help='captured run output (run logs to console)')
    ap.add_argument('--anchors', default='P1,P2,P3,P4,open,mitigated,resolved')
    ap.add_argument('--forbidden', default='authentication,login,notification,SLA timer,attachment')
    args = ap.parse_args()
    root = Path(args.root)
    anchors = [a.strip() for a in args.anchors.split(',') if a.strip()]
    forbidden = [f.strip() for f in args.forbidden.split(',') if f.strip()]

    # ---------- A. log / state / marker / commit consistency ----------
    state = {}
    state_path = root / '.pipeline' / 'state.json'
    check('A: state.json exists', state_path.exists())
    if state_path.exists():
        state = json.loads(read(state_path))
    done_stages = [s for s, v in state.get('stages', {}).items() if v.get('status') == 'done']
    failed_stages = [s for s, v in state.get('stages', {}).items() if v.get('status') == 'failed']
    check('A: no failed stages in state', not failed_stages, failed_stages)

    log_text = read(Path(args.log)) if args.log else ''
    if log_text:
        partial = bool(done_stages) and not re.search(rf'stage {done_stages[0]}\s+RUNNING', log_text)
        if partial:
            warn('A: log is PARTIAL (captured tail) — per-stage checks limited to visible stages')
        visible = [s for s in done_stages if re.search(rf'stage {s}\s+(RUNNING|DONE)', log_text)]
        for s in visible:
            check(f'A: log has DONE for {s}', bool(re.search(rf'stage {s}\s+DONE', log_text)))
        check('A: no FAILED lines in log', 'FAILED' not in log_text,
              [l for l in log_text.splitlines() if 'FAILED' in l][:2])
        done_order_log = re.findall(r'stage (\w+)\s+DONE', log_text)
        expect = [s for s in done_stages if s in done_order_log]
        check('A: visible log DONE order matches state order',
              done_order_log == expect, f'{done_order_log} vs {expect}')
    else:
        warn('A: no run log provided — log checks skipped')

    # markers: a done stage that writes a marker must have one on disk
    marker_dirs = {'ingest': '01_requirements', 'product': '02_specs', 'architect': '03_architecture',
                   'code_backend': '04_source', 'qa': '05_test_reports', 'docs': '06_docs'}
    for s in done_stages:
        if s in marker_dirs:
            check(f'A: marker present for {s}', (root / marker_dirs[s] / '.status_done').exists())

    # auto-commits: one per done stage, in order (or an explicit skip in the log)
    try:
        gitlog = subprocess.run(['git', 'log', '--format=%s'], cwd=root, capture_output=True,
                                text=True).stdout.splitlines()
        commit_stages = [m.group(1) for line in reversed(gitlog)
                         if (m := re.match(r'pipeline: (\w+) stage complete', line))]
        if commit_stages:
            check('A: auto-commits match done stages in order', commit_stages == done_stages,
                  f'{commit_stages} vs {done_stages}')
        elif 'auto-commit skipped' in log_text:
            warn('A: auto-commits skipped by branch policy (log confirms)')
        else:
            check('A: auto-commits present', False, 'none found and no skip logged')
    except OSError:
        warn('A: git not available for commit check')

    # ---------- B. plan (backlog) vs requirements ----------
    briefs = [p for p in (root / '00_input').glob('*.md') if p.name.lower() != 'readme.md']
    brief = read(briefs[0]) if briefs else ''
    backlog_path = root / '02_specs' / 'PRODUCT_BACKLOG.md'
    backlog = read(backlog_path)
    check('B: PRODUCT_BACKLOG.md exists and is substantial', len(backlog) > 500, f'{len(backlog)} chars')
    if backlog:
        brief_story_count = len(re.findall(r'^### STORY', brief, re.M))
        backlog_ids = sorted(set(re.findall(r'STORY-\d+', backlog)))
        # scope equivalence, not count equality: fewer stories = dropped scope
        # (FAIL); more stories = decomposition, surfaced for human review (WARN)
        check(f'B: no dropped scope (>= {brief_story_count} stories)',
              len(backlog_ids) >= brief_story_count, backlog_ids)
        if len(backlog_ids) > brief_story_count:
            warn(f'B: {len(backlog_ids)} stories vs {brief_story_count} in brief — review decomposition', str(backlog_ids))
        gherkin = len(re.findall(r'\bGiven\b', backlog))
        check('B: every story has Gherkin acceptance criteria',
              gherkin >= max(1, len(backlog_ids)), f'{gherkin} Given-blocks for {len(backlog_ids)} stories')
        for a in anchors:
            check(f'B: backlog carries domain anchor "{a}"', a.lower() in backlog.lower())
        for f in forbidden:
            hits = [l.strip() for l in backlog.splitlines() if f.lower() in l.lower()]
            creep = [h for h in hits if not re.search(r'out of scope|not includ|exclude|no [a-z]*\b' + f.split()[0].lower(), h.lower())]
            check(f'B: no scope creep: "{f}"', not creep, creep[:2])

    # ---------- C. design / architecture consistency ----------
    arch = root / '03_architecture'
    arch_files = list(arch.rglob('*.*')) if arch.exists() else []
    arch_text = '\n'.join(read(p) for p in arch_files if p.suffix in ('.md', '.yaml', '.yml'))
    check('C: architecture artifacts exist', len(arch_files) >= 3,
          [p.name for p in arch_files])
    backlog_ids = sorted(set(re.findall(r'STORY-\d+', backlog)))
    for sid in backlog_ids:
        # coverage = a per-story UI spec file (specs are named by ID, not cited
        # inline in openapi/data-model — file presence is the real signal)
        check(f'C: UI spec file exists for {sid}', (arch / 'ui' / f'{sid}.md').exists())
    openapis = [p for p in arch_files if p.name in ('openapi.yaml', 'openapi.yml')]
    if openapis:
        try:
            import yaml  # available in the pipeline venv
            spec = yaml.safe_load(read(openapis[0]))
            check('C: openapi parses with paths', bool(spec.get('paths')),
                  list(spec)[:5] if isinstance(spec, dict) else type(spec).__name__)
        except Exception as e:  # noqa: BLE001
            check('C: openapi parses with paths', False, str(e)[:80])
    else:
        warn('C: no openapi.yaml found')
    for a in anchors:
        check(f'C: architecture carries anchor "{a}"', a.lower() in arch_text.lower())
    # datastore/data-model consistency: SQLite can't use native Prisma enums
    # or provider-specific @db.* attributes (recurring codegen failure)
    is_sqlite = 'sqlite' in arch_text.lower()
    dm = read(arch / 'DATA_MODEL.md')
    if is_sqlite and dm:
        native_enum = re.search(r'^\s*enum\s+\w+\s*\{', dm, re.M) or re.search(r'\bEnum[A-Z]\w+', dm)
        check('C: no native Prisma enums on SQLite', not native_enum,
              'data model uses native enums (e.g. %s) — fails prisma db push on SQLite'
              % (native_enum.group(0) if native_enum else ''))
        db_attrs = re.findall(r'@db\.\w+', dm)
        check('C: no provider-specific @db.* attrs on SQLite', not db_attrs,
              sorted(set(db_attrs)))

    # ---------- D. documentation quality ----------
    doc_targets = {'backlog': backlog, 'architecture': arch_text}
    # case-sensitive dev tokens ('placeholder' is a legit UI empty-state term,
    # e.g. an input placeholder or empty-state region, so it must not trip)
    placeholders = ['TODO', 'TBD', 'PLACEHOLDER', 'FIXME']
    for name, text in doc_targets.items():
        if not text:
            continue
        found = [p for p in placeholders if re.search(rf'\b{p}\b', text)]
        if re.search(r'lorem ipsum', text, re.I):
            found.append('lorem ipsum')
        check(f'D: {name} has no placeholders', not found, found)
    project = ''
    cfg = read(root / '.pipeline' / 'config.yaml')
    if (m := re.search(r'name:\s*"([^"]+)"', cfg)):
        project = m.group(1)
    if project:
        norm = lambda t: re.sub(r'[^a-z0-9]', '', t.lower())
        check(f'D: docs name the project ({project})', norm(project) in norm(backlog + arch_text))
    # leakage from previous projects built with this machinery
    for leak in ['My Local Agent App', 'mxtac', 'agent console']:
        found_in = [n for n, t in doc_targets.items() if leak.lower() in t.lower()]
        check(f'D: no leakage of "{leak}"', not found_in, found_in)

    print('\n=== STAGE VERIFIER: %d passed, %d failed, %d warnings ===' % (len(PASS), len(FAIL), len(WARN)))
    for f in FAIL:
        print('FAIL:', f)
    for w in WARN:
        print('WARN:', w)
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
