#!/usr/bin/env python3
"""
ACP Identity Reconciler for OpenClaw Claude sessions.
Fixes sessions.json when acpxSessionId doesn't match the actual acp_session_id
from the acpx session records. This happens due to a regression in OpenClaw
2026.3.7 where the identity callback path is broken after gateway restart.

Usage: python3 acp-identity-reconciler.py [--dry-run]
"""
import json, os, glob, time, sys, argparse

SESSIONS_PATH = '/Users/henrysopenclaw/.openclaw/agents/claude/sessions/sessions.json'
ACPX_DIR = os.path.expanduser('~/.acpx/sessions')

def run(dry_run=False):
    if not os.path.exists(SESSIONS_PATH):
        print(f"sessions.json not found at {SESSIONS_PATH}")
        return 0

    with open(SESSIONS_PATH) as f:
        sessions = json.load(f)

    acpx_records = {}
    for fname in glob.glob(f'{ACPX_DIR}/*.json'):
        with open(fname) as f:
            try:
                d = json.load(f)
            except Exception:
                continue
        record_id = d.get('acpx_record_id', '')
        if record_id:
            acpx_records[record_id] = d

    now_ms = int(time.time() * 1000)
    fix_count = 0

    for key, session in sessions.items():
        acp = session.get('acp', {})
        identity = acp.get('identity', {})
        if identity.get('state') != 'pending':
            continue

        record_id = identity.get('acpxRecordId')
        current_session_id = identity.get('acpxSessionId')
        acpx_rec = acpx_records.get(record_id, {})
        actual_session_id = acpx_rec.get('acp_session_id')
        closed = acpx_rec.get('closed', False)

        # Only fix closed sessions with a different (correct) session ID
        if actual_session_id and actual_session_id != current_session_id and closed:
            if dry_run:
                print(f"[DRY-RUN] Would fix: {key}")
                print(f"  {current_session_id} -> {actual_session_id}")
            else:
                identity['acpxSessionId'] = actual_session_id
                identity['state'] = 'resolved'
                identity['lastUpdatedAt'] = now_ms
                identity['resolvedBy'] = f'reconciler-{time.strftime("%Y-%m-%d")}'
                print(f"Fixed: {key} -> {actual_session_id}")
            fix_count += 1

    if not dry_run and fix_count > 0:
        # Backup before writing
        bak = SESSIONS_PATH + f'.bak.reconciler.{int(time.time())}'
        with open(SESSIONS_PATH) as f:
            bak_content = f.read()
        with open(bak, 'w') as f:
            f.write(bak_content)
        with open(SESSIONS_PATH, 'w') as f:
            json.dump(sessions, f, indent=2)
        print(f"Updated sessions.json ({fix_count} fixes). Backup: {bak}")
    elif fix_count == 0:
        print("No pending sessions need fixing.")
    return fix_count

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='ACP identity reconciler')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    args = parser.parse_args()
    result = run(dry_run=args.dry_run)
    sys.exit(0 if result >= 0 else 1)
