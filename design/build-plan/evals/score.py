#!/usr/bin/env python3
"""Spec section 4 score for one app. Usage:
  score.py <day> <app> value=6 ttv=4 trust=5 action=7 ux=8 diff=5 feas=6 seo=3 copy=6 [--note "..."]
Each category 0 to 10, or 'nm' for not measured (counted as 0 and flagged). Score = sum(cat*weight)/10.
Appends to ../scores/<YYYY-MM-DD>/devradar.csv and ../scores/app-history.csv."""
import sys, csv, os, datetime
W = dict(value=20, ttv=15, trust=15, action=15, ux=10, diff=10, feas=5, seo=5, copy=5)
day, app, *rest = sys.argv[1:]
note = ''
if '--note' in rest:
    i = rest.index('--note'); note = rest[i+1]; rest = rest[:i] + rest[i+2:]
vals = dict(kv.split('=') for kv in rest)
missing = [k for k in W if k not in vals]
if missing: sys.exit(f'missing categories: {missing}')
nm = [k for k, v in vals.items() if v == 'nm']
num = {k: (0.0 if v == 'nm' else float(v)) for k, v in vals.items()}
if any(not 0 <= v <= 10 for v in num.values()): sys.exit('each category must be 0 to 10')
total = round(sum(num[k] * W[k] for k in W) / 10, 1)
live_gate = total >= 75 and num['trust'] >= 7 and not nm
here = os.path.dirname(os.path.abspath(__file__))
date = datetime.date.today().isoformat()
row = dict(date=date, day=day, app=app, **{k: vals[k] for k in W}, score=total, not_measured=';'.join(nm), live_gate=live_gate, note=note)
for path in (os.path.join(here, '..', 'scores', date, 'devradar.csv'), os.path.join(here, '..', 'scores', 'app-history.csv')):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    new = not os.path.exists(path)
    with open(path, 'a', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(row)); new and w.writeheader(); w.writerow(row)
print(f'{app} {day}: {total} (live gate {"pass" if live_gate else "fail"}){" not measured: " + ",".join(nm) if nm else ""}')
