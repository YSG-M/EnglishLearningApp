"""Rewrite a unit / week JSON file in the compact house style: flat objects on one line.

usage: python -I .agent-wiki/tools/fmt_unit.py content/units/u01-greetings.json [...]
"""
import json, sys

def flat(v):
    if isinstance(v, dict):
        return all(not isinstance(x, (dict, list)) or (isinstance(x, list) and all(not isinstance(y, (dict, list)) for y in x)) for x in v.values())
    return not isinstance(v, list) or all(not isinstance(y, (dict, list)) for y in v)

def one(v):
    return json.dumps(v, ensure_ascii=False, separators=(', ', ': '))

def dump(v, ind=0):
    pad = '  ' * ind
    if isinstance(v, dict):
        if flat(v) and ind > 0 and len(one(v)) < 400:
            return one(v)
        items = [f'{pad}  {json.dumps(k, ensure_ascii=False)}: {dump(x, ind + 1)}' for k, x in v.items()]
        return '{\n' + ',\n'.join(items) + '\n' + pad + '}'
    if isinstance(v, list):
        if flat(v):
            return one(v)
        return '[\n' + ',\n'.join(f'{pad}  {dump(x, ind + 1)}' for x in v) + '\n' + pad + ']'
    return one(v)

for path in sys.argv[1:]:
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(dump(data) + '\n')
