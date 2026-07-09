# API contract & negative-path suite for the agent console backend.
# 30 checks: zod validation rejections, 404/409/400 semantics, graph
# pathologies (cycles, dangling branches), runtime failures (bad regex,
# orphaned agents), unicode, boundary lengths. Zero LLM calls; self-cleaning.
#
# Usage: start the backend (PORT=3001), then:
#   PYTHONIOENCODING=utf-8 python tools/qa/qa_api.py

import json, time, urllib.request, urllib.error

B = 'http://127.0.0.1:3001'
PASS, FAIL = [], []
def check(name, cond, detail=''):
    (PASS if cond else FAIL).append(name + ((' -- ' + str(detail)) if (detail and not cond) else ''))

def req(method, u, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(B + u, data, {'Content-Type': 'application/json'}, method=method)
    try:
        resp = urllib.request.urlopen(r)
        raw = resp.read()
        return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, {}

HEALTH = 'http://localhost:3001/api/health'
def http_node(url=HEALTH): return {'nodeType': 'http', 'config': {'method': 'GET', 'url': url}}
def logic_node(op='contains', value='ok'): return {'nodeType': 'logic', 'config': {'op': op, 'value': value}}
def mkname(s): return 'QA %s %d' % (s, time.time_ns() % 1000000)

# ---- validation rejections ----
c, _ = req('POST', '/api/pipelines', {'name': mkname('v1'), 'steps': []})
check('empty steps -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v2'), 'steps': [http_node()] * 13})
check('13 steps -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v3'), 'steps': [http_node()], 'edges': [{'from': 0, 'to': 5}]})
check('edge index out of range -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v4'), 'steps': [http_node(), http_node()], 'edges': [{'from': 0, 'to': 0}]})
check('self edge -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v5'), 'steps': [{'nodeType': 'agent'}]})
check('agent node without agentId -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v6'), 'steps': [logic_node(value='')]})
check('logic without value -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v7'), 'steps': [{'nodeType': 'http', 'config': {'url': 'ftp://x'}}]})
check('http bad scheme -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v8'), 'steps': [http_node()], 'triggerType': 'interval', 'intervalSec': 60})
check('interval trigger without defaultTask -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('v9'), 'steps': [http_node()], 'triggerType': 'interval', 'intervalSec': 5, 'defaultTask': 'x'})
check('interval < 10s -> 400', c == 400, c)
c, _ = req('POST', '/api/pipelines', {'name': 'x' * 121, 'steps': [http_node()]})
check('name 121 chars -> 400', c == 400, c)

# ---- agent context/memory fields ----
c, ag = req('POST', '/api/agents', {'name': mkname('ctx'), 'context': 'codeword X', 'memory': True})
check('agent create with context+memory -> 201', c == 201 and ag.get('context') == 'codeword X' and ag.get('memory') is True, (c, ag.get('context'), ag.get('memory')))
c, _ = req('POST', '/api/agents', {'name': mkname('ctx2'), 'context': 'x' * 8001})
check('context 8001 chars -> 400', c == 400, c)
c, _ = req('POST', '/api/agents', {'name': mkname('ctx3'), 'memory': 'yes'})
check('memory non-boolean -> 400', c == 400, c)
c, upd = req('PUT', '/api/agents/' + ag['id'], {'name': ag['name'], 'role': 'probe'})
check('partial update preserves context+memory', c == 200 and upd.get('context') == 'codeword X' and upd.get('memory') is True, (c, upd.get('context'), upd.get('memory')))
req('DELETE', '/api/agents/' + ag['id'])

# ---- 404 / 409 semantics ----
dup = mkname('dup')
c, p1 = req('POST', '/api/pipelines', {'name': dup, 'steps': [http_node()]})
check('valid create -> 201', c == 201, c)
c, _ = req('POST', '/api/pipelines', {'name': dup, 'steps': [http_node()]})
check('duplicate name -> 409', c == 409, c)
c, _ = req('PUT', '/api/pipelines/00000000-0000-4000-8000-000000000000', {'name': mkname('nf'), 'steps': [http_node()]})
check('update unknown pipeline -> 404', c == 404, c)
c, _ = req('POST', '/api/pipelines/00000000-0000-4000-8000-000000000000/runs', {'task': 'x'})
check('run unknown pipeline -> 404', c == 404, c)
c, _ = req('GET', '/api/pipeline-runs/not-a-uuid')
check('bad run id -> 400', c == 400, c)
c, _ = req('POST', '/api/hooks/not-a-uuid', {})
check('bad webhook key -> 400', c == 400, c)
c, _ = req('POST', '/api/hooks/00000000-0000-4000-8000-000000000000', {})
check('unknown webhook -> 404', c == 404, c)
c, _ = req('DELETE', '/api/pipelines/' + p1['id'])
check('delete -> 204', c == 204, c)
c, _ = req('DELETE', '/api/pipelines/' + p1['id'])
check('second delete -> 404', c == 404, c)
c, _ = req('POST', '/api/pipelines', {'name': mkname('t16k'), 'steps': [http_node()], 'defaultTask': 'x' * 16001})
check('defaultTask 16001 chars -> 400 (cap raised to 16000 with num_ctx fix)', c == 400, c)

# ---- run semantics (zero-LLM) ----
def run_and_wait(pid, task, timeout=30):
    _, r = req('POST', '/api/pipelines/' + pid + '/runs', {'task': task})
    for _ in range(timeout):
        time.sleep(1)
        _, r = req('GET', '/api/pipeline-runs/' + r['id'])
        if r['status'] != 'running':
            return r
    return r

c, p = req('POST', '/api/pipelines', {'name': mkname('dangle'),
  'steps': [http_node(), logic_node(value='NOPE_NOT_THERE'), http_node()],
  'edges': [{'from': 0, 'to': 1}, {'from': 1, 'to': 2, 'branch': 'true'}]})
r = run_and_wait(p['id'], 'go')
sts = [s['status'] for s in r['steps']]
check('dangling false-branch: succeeded + tail skipped',
      r['status'] == 'succeeded' and sts == ['succeeded', 'succeeded', 'skipped'], (r['status'], sts))
check('dangling: output passes through logic', r['output'].startswith('{"status"'), r['output'][:30])
req('DELETE', '/api/pipelines/' + p['id'])

c, p = req('POST', '/api/pipelines', {'name': mkname('cycle'),
  'steps': [http_node(), http_node()],
  'edges': [{'from': 0, 'to': 1}, {'from': 1, 'to': 0}]})
check('cycle save allowed (frontend guards)', c == 201, c)
r = run_and_wait(p['id'], 'go')
check('cycle run fails gracefully', r['status'] == 'failed' and 'start' in r['error'], r.get('error', '')[:60])
req('DELETE', '/api/pipelines/' + p['id'])

c, p = req('POST', '/api/pipelines', {'name': mkname('rex'),
  'steps': [logic_node(op='matches_regex', value='(['), http_node()],
  'edges': [{'from': 0, 'to': 1, 'branch': 'true'}]})
r = run_and_wait(p['id'], 'go')
check('invalid regex: failed with clear error',
      r['status'] == 'failed' and 'Invalid regular expression' in r['error'], r.get('error', '')[:60])
check('invalid regex: downstream skipped', r['steps'][1]['status'] == 'skipped', r['steps'][1]['status'])
req('DELETE', '/api/pipelines/' + p['id'])

c, p = req('POST', '/api/pipelines', {'name': mkname('kr'),
  'steps': [logic_node(value=u'위험'), http_node()],
  'edges': [{'from': 0, 'to': 1, 'branch': 'true'}]})
r = run_and_wait(p['id'], u'위험 등급: 높음 - 즉시 조치 필요')
check('unicode condition matched, true path ran',
      r['status'] == 'succeeded' and r['steps'][1]['status'] == 'succeeded',
      (r['status'], [s['status'] for s in r['steps']]))
req('DELETE', '/api/pipelines/' + p['id'])

c, ag = req('POST', '/api/agents', {'name': mkname('victim')})
c, p = req('POST', '/api/pipelines', {'name': mkname('orphan'),
  'steps': [{'nodeType': 'agent', 'agentId': ag['id']}]})
req('DELETE', '/api/agents/' + ag['id'])
_, plist = req('GET', '/api/pipelines')
mine = next(x for x in plist if x['id'] == p['id'])
check('agent delete keeps the step (SetNull)',
      len(mine['steps']) == 1 and mine['steps'][0]['agentId'] is None, mine['steps'])
r = run_and_wait(p['id'], 'hello')
check('orphaned agent node: failed with clear error',
      r['status'] == 'failed' and 'no longer exists' in r['error'], r.get('error', '')[:70])
req('DELETE', '/api/pipelines/' + p['id'])

c, p = req('POST', '/api/pipelines', {'name': mkname('keep'),
  'steps': [http_node(), logic_node(), http_node()],
  'edges': [{'from': 0, 'to': 1}, {'from': 1, 'to': 2, 'branch': 'false'}]})
body = {'name': p['name'], 'enabled': False,
        'steps': [{'nodeType': s['nodeType'], 'config': s['config'], 'posX': s['posX'], 'posY': s['posY']} for s in p['steps']],
        'edges': [{'from': 0, 'to': 1}, {'from': 1, 'to': 2, 'branch': 'false'}]}
c, upd = req('PUT', '/api/pipelines/' + p['id'], body)
check('toggle-style update keeps edges + branch',
      c == 200 and len(upd['edges']) == 2 and any(e['branch'] == 'false' for e in upd['edges']),
      (c, upd.get('edges')))
req('DELETE', '/api/pipelines/' + p['id'])

print('')
print('=== API SUITE: %d passed, %d failed ===' % (len(PASS), len(FAIL)))
for f in FAIL:
    print('FAIL:', f)
