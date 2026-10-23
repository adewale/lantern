"""
Oracle: manim's own math, executed from a checkout of 3b1b/manim.

Reads a JSON request on stdin, answers on stdout. The functions are extracted
from manim's source by name (ast), not retyped, so what runs here is what
manim runs. Only numpy is needed; the rest of manim is never imported.

  MANIM_DIR=path/to/manim python3 -I tools/oracle/manim_math.py < request.json

Request: { "rates": [t...], "distribute": [{ "lengths": [...], "n": k }],
           "partial": [{ "points": [[x,y],...], "a": 0.2, "b": 0.7 }] }
"""
import ast, json, math, os, sys
from functools import lru_cache
import numpy as np

ROOT = os.environ.get('MANIM_DIR') or sys.exit('MANIM_DIR is not set')
FUTURE = ast.ImportFrom('__future__', [ast.alias('annotations')], 0)
PINNED = 'fafa083a4fb274bba9cabde0b6e2f50ba6da0622'


def extract(path, names, ns):
    """exec only the named top-level defs of a manim source file into ns."""
    src = open(os.path.join(ROOT, path)).read()
    tree = ast.parse(src)
    picked = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in names]
    missing = set(names) - {n.name for n in picked}
    if missing: sys.exit(f'{path}: not found: {missing}')
    # Annotations are evaluated lazily (PEP 563) so typing names need not exist
    exec(compile(ast.fix_missing_locations(ast.Module([FUTURE] + picked, [])), path, 'exec'), ns)


def method(path, cls, name, ns):
    """exec one method of a manim class as a plain function (self is a stub)."""
    src = open(os.path.join(ROOT, path)).read()
    for node in ast.parse(src).body:
        if isinstance(node, ast.ClassDef) and node.name == cls:
            for m in node.body:
                if isinstance(m, ast.FunctionDef) and m.name == name:
                    exec(compile(ast.fix_missing_locations(ast.Module([FUTURE, m], [])), path, 'exec'), ns)
                    return
    sys.exit(f'{path}: {cls}.{name} not found')


ns = {'np': np, 'math': math, 'lru_cache': lru_cache, '__name__': 'oracle', 'TYPE_CHECKING': False}
extract('manimlib/utils/simple_functions.py', ['choose'], ns)
extract('manimlib/utils/bezier.py', ['bezier', 'partial_bezier_points', 'interpolate'], ns)
extract('manimlib/utils/rate_functions.py', ['linear', 'smooth', 'rush_into', 'rush_from', 'there_and_back'], ns)
extract('manimlib/utils/iterables.py', ['index_within_group'], ns)
method('manimlib/mobject/types/vectorized_mobject.py', 'VMobject', 'insert_n_curves_to_point_list', ns)


class Stub:
    tolerance_for_point_equality = 1e-8


req = json.load(sys.stdin)
out = {}
if 'rates' in req:
    out['rates'] = {k: [float(ns[k](t)) for t in req['rates']] for k in ['linear', 'smooth', 'rush_into', 'rush_from', 'there_and_back']}
if 'distribute' in req:
    res = []
    for d in req['distribute']:
        # A quadratic path along the x axis whose curves have the given lengths; only
        # the anchor spacing matters for how manim distributes the n new curves.
        xs = np.concatenate([[0.0], np.cumsum(d['lengths'])])
        pts = np.zeros((2 * len(xs) - 1, 2))
        pts[0::2, 0] = xs
        pts[1::2, 0] = (xs[:-1] + xs[1:]) / 2
        new = ns['insert_n_curves_to_point_list'](Stub(), d['n'], pts)
        # Count the pieces each original curve became: a piece's handle lies strictly
        # inside its source curve, and a zero-length curve's handle sits on its anchor.
        hs = new[1::2, 0]
        counts = [int(np.sum((hs > xs[i] + 1e-9) & (hs < xs[i + 1] - 1e-9))) if xs[i + 1] > xs[i]
                  else int(np.sum(np.abs(hs - xs[i]) < 1e-9)) for i in range(len(xs) - 1)]
        res.append(counts)
    out['distribute'] = res
if 'partial' in req:
    out['partial'] = [[list(map(float, p)) for p in ns['partial_bezier_points']([np.array(q, float) for q in d['points']], d['a'], d['b'])] for d in req['partial']]
json.dump(out, sys.stdout)
