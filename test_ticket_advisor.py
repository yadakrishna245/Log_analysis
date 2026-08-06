"""Quick test for ticket advisor - bypasses problematic imports."""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'

# Mock the imports that ticket_advisor.py needs
class MockPattern:
    def __init__(self, name='', severity='', category='', description=''):
        self.name = name
        self.severity = severity
        self.category = category
        self.description = description

# Pre-create knowledge module mocks
import types

# Create knowledge package
knowledge_pkg = types.ModuleType('knowledge')
knowledge_pkg.__path__ = [os.path.join(os.path.dirname(os.path.abspath(__file__)), 'knowledge')]
sys.modules['knowledge'] = knowledge_pkg

# Import known_issues directly
knowledge_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'knowledge')
sys.path.insert(0, knowledge_dir)

# Try to import knowledge modules
try:
    from knowledge.known_issues import KNOWN_ISSUES
    print(f"  Loaded {len(KNOWN_ISSUES)} known issues")
except Exception as e:
    print(f"  Could not load known_issues: {e}")
    KNOWN_ISSUES = []

try:
    from knowledge.runbooks import RUNBOOKS
    print(f"  Loaded {len(RUNBOOKS)} runbooks")
except Exception as e:
    print(f"  Could not load runbooks: {e}")
    RUNBOOKS = {}

# Mock engine.patterns since it may need heavy deps
engine_pkg = types.ModuleType('engine')
engine_pkg.__path__ = [os.path.join(os.path.dirname(os.path.abspath(__file__)), 'engine')]
sys.modules['engine'] = engine_pkg

engine_patterns = types.ModuleType('engine.patterns')
engine_patterns.BUILT_IN_PATTERNS = []
sys.modules['engine.patterns'] = engine_patterns

# Import ticket_advisor via importlib to avoid __init__.py chain
import importlib.util
_ta_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'engine', 'ticket_advisor.py')
_ta_spec = importlib.util.spec_from_file_location('engine.ticket_advisor', _ta_path)
_ta_mod = importlib.util.module_from_spec(_ta_spec)
sys.modules['engine.ticket_advisor'] = _ta_mod
_ta_spec.loader.exec_module(_ta_mod)
get_advisor = _ta_mod.get_advisor
TicketAdvisor = _ta_mod.TicketAdvisor

print("\n🎯 LogSherlock Pro — Ticket Advisor Quick Test")
print("=" * 70)

advisor = get_advisor()
print(f"✅ Advisor loaded: {len(advisor.known_issues)} issues, {len(advisor.patterns)} patterns, {len(advisor.runbooks)} runbooks")

# ── TEST 1: Initial Ticket ──
print("\n" + "=" * 70)
print("TEST 1: Initial Jira Ticket (MORPHL4-85)")
print("=" * 70)

ticket = """After adding hosts to the existing cluster, the datastore type of the existing datastore changed from GFS2 to Directory Pool.
For VMs created on the Directory Pool datastore, host migration cannot be performed unless the VM is powered off.
"Server must be powered off to move hosts because it is on local storage."
VM Name: LABVMSRV01, testvm01-inet, testvm02-inet
Hosts added: labnode11, labnode12, labnode13, labnode14, labnode15
Already referred: MORPH-7774
labnode12 has SCSI-3 persistent-reservation conflict:
kernel: sd 7:0:2:244: reservation conflict
kernel: gfs2: Error 6 writing to journal - about to withdraw this file system
The libvirt storage pools are <pool type='dir'> pointing at /mnt/<uuid>
VM XML: <morpheus:local-storage>true</morpheus:local-storage>
mysql> select id,name,datastore_type_id from datastore;
| 20 | LABSTORE-01 | 1 |
| 22 | LABSTORE-02 | 1 |
| 23 | LABSTORE-mgmt01 | 1 |
| 24 | LABSTORE-NFS01 | 1 |"""

messages = [{"role": "user", "content": ticket}]
start = time.time()
result = advisor.analyze_conversation(messages)
elapsed = (time.time() - start) * 1000

print(f"  ⏱️  Time: {elapsed:.1f}ms")
print(f"  📋 Type: {result.get('response_type')}")
print(f"  🏷️  Categories: {result.get('categories', [])}")
print(f"  📝 Root cause: {result.get('root_cause', '')[:150]}...")
print(f"  🔧 Steps: {len(result.get('action_plan', []))}")
for i, s in enumerate(result.get('action_plan', [])[:5], 1):
    risk = s.get('risk_level', '?')
    icon = '🟢' if risk == 'safe' else '🟡' if risk == 'medium' else '🔴'
    print(f"     {i}. [{icon} {risk}] {s.get('step', '')[:55]}")

assert result['response_type'] == 'initial_analysis', f"Expected initial_analysis, got {result['response_type']}"
assert len(result.get('action_plan', [])) > 0, "No action plan"
assert elapsed < 500, f"Too slow: {elapsed}ms"
print("  ✅ PASSED")

# ── TEST 2: Follow-up - DB fix but GUI wrong ──
print("\n" + "=" * 70)
print("TEST 2: Follow-up — DB Fixed, GUI Still Wrong")
print("=" * 70)

messages = [
    {"role": "user", "content": "GFS2 changed to Directory Pool after adding hosts. MORPH-7774. SCSI reservation on labnode12."},
    {"role": "assistant", "content": "DB fix provided..."},
    {"role": "user", "content": """The Customer restarted the service and accessed it again using an incognito window,
but the "Directory Pool" display was not corrected.
mysql> SELECT id, name, datastore_type_id FROM datastore WHERE id IN (20, 22, 23, 24);
| 20 | LABSTORE-01 | 5 |
| 22 | LABSTORE-02 | 5 |
| 23 | LABSTORE-mgmt01 | 5 |
| 24 | LABSTORE-NFS01 | 5 |
Customer has below questions -
What kind of operation might trigger this?
Is there any way to resolve this other than upgrade to 8.1.2 now?"""},
]

start = time.time()
result = advisor.analyze_conversation(messages)
elapsed = (time.time() - start) * 1000

print(f"  ⏱️  Time: {elapsed:.1f}ms")
print(f"  📋 Type: {result.get('response_type')}")
print(f"  🔍 Context: {result.get('metadata', {}).get('context_detected')}")
print(f"  💬 Turn: {result.get('metadata', {}).get('conversation_turn')}")
print(f"  📝 Root cause: {result.get('root_cause', '')[:150]}...")
print(f"  🔧 Steps: {len(result.get('action_plan', []))}")
for i, s in enumerate(result.get('action_plan', [])[:4], 1):
    risk = s.get('risk_level', '?')
    icon = '🟢' if risk == 'safe' else '🟡' if risk == 'medium' else '🔴'
    print(f"     {i}. [{icon} {risk}] {s.get('step', '')[:55]}")

assert result['response_type'] == 'followup_guidance', f"Expected followup_guidance, got {result['response_type']}"
assert result['metadata']['conversation_turn'] == 2
assert elapsed < 500
print("  ✅ PASSED")

# ── TEST 3: Follow-up - Fix confirmed ──
print("\n" + "=" * 70)
print("TEST 3: Follow-up — Fix Confirmed Working")
print("=" * 70)

messages = [
    {"role": "user", "content": "GFS2 changed to Directory Pool. MORPH-7774."},
    {"role": "assistant", "content": "Options A/B provided..."},
    {"role": "user", "content": "DB still wrong after restart"},
    {"role": "assistant", "content": "Disable sync options..."},
    {"role": "user", "content": "Option A worked. Unchecked Inventory Existing Instances and the GUI now shows GFS2 Pool. Confirmed working after 30 minutes."},
]

start = time.time()
result = advisor.analyze_conversation(messages)
elapsed = (time.time() - start) * 1000

print(f"  ⏱️  Time: {elapsed:.1f}ms")
print(f"  📋 Type: {result.get('response_type')}")
print(f"  🔍 Context: {result.get('metadata', {}).get('context_detected')}")
print(f"  💬 Turn: {result.get('metadata', {}).get('conversation_turn')}")
print(f"  🔧 Steps: {len(result.get('action_plan', []))}")
for i, s in enumerate(result.get('action_plan', [])[:4], 1):
    risk = s.get('risk_level', '?')
    icon = '🟢' if risk == 'safe' else '🟡' if risk == 'medium' else '🔴'
    print(f"     {i}. [{icon} {risk}] {s.get('step', '')[:55]}")

assert result['metadata']['context_detected'] == 'fix_confirmed'
assert elapsed < 500
print("  ✅ PASSED")

# ── TEST 4: Formatted reply quality ──
print("\n" + "=" * 70)
print("TEST 4: Formatted Reply Quality")
print("=" * 70)

result = advisor.analyze_conversation([
    {"role": "user", "content": "GFS2 changed to Directory Pool. MORPH-7774."},
    {"role": "assistant", "content": "..."},
    {"role": "user", "content": "DB shows 5 but GUI still shows Directory Pool. Customer asks what triggers it."},
])

reply = result.get('formatted_reply', '')
print(f"  📄 Reply length: {len(reply)} chars")
print(f"  {'─' * 55}")
print(f"  {reply[:400]}...")
print(f"  {'─' * 55}")

has_content = len(reply) > 100
has_steps = 'step' in reply.lower() or 'action' in reply.lower() or 'option' in reply.lower()
print(f"  {'✅' if has_content else '❌'} Has substantial content ({len(reply)} chars)")
print(f"  {'✅' if has_steps else '❌'} Has actionable steps")
assert has_content
assert has_steps
print("  ✅ PASSED")

# ── TEST 5: Speed ──
print("\n" + "=" * 70)
print("TEST 5: Speed (10 iterations)")
print("=" * 70)

times = []
for _ in range(10):
    start = time.time()
    advisor.analyze_conversation([{"role": "user", "content": ticket}])
    times.append((time.time() - start) * 1000)

avg = sum(times) / len(times)
mx = max(times)
mn = min(times)
print(f"  Avg: {avg:.1f}ms | Min: {mn:.1f}ms | Max: {mx:.1f}ms")
print(f"  {'✅' if avg < 100 else '⚠️'} Avg < 100ms: {avg:.1f}ms")
assert avg < 500
print("  ✅ PASSED")

# ── FINAL ──
print("\n" + "=" * 70)
print("🎉 ALL 5 TESTS PASSED — Ticket Advisor is working correctly!")
print("=" * 70)
