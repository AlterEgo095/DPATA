#!/usr/bin/env python3
"""Install ALL packages from bun cache - take latest version of each."""
import os
import shutil
import json
import re
from pathlib import Path

CACHE = Path.home() / '.bun' / 'install' / 'cache'
NM = Path('/home/z/my-project/node_modules')

def normalize(v):
    parts = re.split(r'[.\-]', v)
    out = []
    for p in parts:
        if p.isdigit():
            out.append(int(p))
        else:
            try:
                out.append(int(p))
            except:
                out.append(0)
    return tuple(out)

def install(name):
    """Install latest version of a package from cache."""
    if name.startswith('@'):
        scope, base = name.split('/', 1)
        scope_dir = CACHE / scope
        if not scope_dir.exists():
            return False
        # Cherche base@version@@@1
        candidates = []
        for entry in scope_dir.iterdir():
            if entry.name.startswith(f'{base}@') and entry.name.endswith('@@@1'):
                ver_part = entry.name[len(base) + 1:]
                ver = ver_part.split('@@@')[0]
                candidates.append((ver, entry))
            elif entry.name == base:
                # Dossier miroir, on descend
                for sub in entry.iterdir():
                    if sub.is_dir() and '@@@' in sub.name:
                        ver = sub.name.split('@@@')[0]
                        candidates.append((ver, sub))
        if not candidates:
            return False
        candidates.sort(key=lambda x: normalize(x[0]), reverse=True)
        src = candidates[0][1]
        target = NM / name
    else:
        candidates = []
        for entry in CACHE.iterdir():
            if entry.name.startswith(f'{name}@') and entry.name.endswith('@@@1'):
                ver_part = entry.name[len(name) + 1:]
                ver = ver_part.split('@@@')[0]
                candidates.append((ver, entry))
            elif entry.name == name:
                for sub in entry.iterdir():
                    if sub.is_dir() and '@@@' in sub.name:
                        ver = sub.name.split('@@@')[0]
                        candidates.append((ver, sub))
        if not candidates:
            return False
        candidates.sort(key=lambda x: normalize(x[0]), reverse=True)
        src = candidates[0][1]
        target = NM / name

    if target.exists():
        return True
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, target, symlinks=True, ignore_dangling_symlinks=True)
        return True
    except Exception as e:
        return False

# Liste TOUT ce qui est dans le cache et tente d'installer
print("=== Installation massive depuis le cache bun ===\n")
success = 0
failed = []

# Tous les paquets non scoped
for entry in CACHE.iterdir():
    if not entry.is_dir() or entry.name.startswith('.') or entry.name.endswith('.npm'):
        continue
    name = entry.name.split('@@@')[0]
    if name.startswith('@') or name in ['.', '..']:
        continue
    # On enlève le @version
    if '@' in name:
        name = name.rsplit('@', 1)[0]
    if not name:
        continue
    if install(name):
        success += 1
    else:
        failed.append(name)

# Tous les paquets scoped
for scope_dir in CACHE.iterdir():
    if not scope_dir.is_dir() or not scope_dir.name.startswith('@'):
        continue
    for entry in scope_dir.iterdir():
        if not entry.is_dir() or entry.name.startswith('.') or entry.name.endswith('.npm'):
            continue
        name = entry.name.split('@@@')[0]
        # Pour scoped, name = base (sans @scope)
        full_name = f"{scope_dir.name}/{name}"
        if install(full_name):
            success += 1
        else:
            failed.append(full_name)

print(f"✓ Installés: {success}")
print(f"❌ Échecs: {len(failed)}")
if failed[:10]:
    print("Premiers échecs:", failed[:10])
