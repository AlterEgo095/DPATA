#!/usr/bin/env python3
"""Installation manuelle v2 — gère mieux les paquets scoped."""
import os
import shutil
import json
import re
from pathlib import Path

CACHE_DIR = Path.home() / '.bun' / 'install' / 'cache'
PROJECT_DIR = Path('/home/z/my-project')
NODE_MODULES = PROJECT_DIR / 'node_modules'
PACKAGE_JSON = PROJECT_DIR / 'package.json'

def normalize_version(v: str) -> tuple:
    """Convertit '1.2.3' en tuple comparable (1, 2, 3)."""
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

def find_versions_in_cache(name: str):
    """Trouve toutes les versions disponibles dans le cache pour un paquet."""
    candidates = []
    if name.startswith('@'):
        scope, base = name.split('/', 1)
        scope_dir = CACHE_DIR / scope
        if not scope_dir.exists():
            return []
        # Format 1: @scope/base@version@@@1
        for entry in scope_dir.iterdir():
            if entry.name.startswith(f'{base}@'):
                ver_part = entry.name[len(base) + 1:]
                ver = ver_part.split('@@@')[0]
                candidates.append((ver, entry))
            elif entry.name == base:
                # Dossier miroir sans version, on descend
                for sub in entry.iterdir():
                    if sub.is_dir() and '@@@' in sub.name:
                        ver = sub.name.split('@@@')[0]
                        candidates.append((ver, sub))
    else:
        for entry in CACHE_DIR.iterdir():
            if entry.name.startswith(f'{name}@'):
                ver_part = entry.name[len(name) + 1:]
                ver = ver_part.split('@@@')[0]
                candidates.append((ver, entry))
            elif entry.name == name:
                for sub in entry.iterdir():
                    if sub.is_dir() and '@@@' in sub.name:
                        ver = sub.name.split('@@@')[0]
                        candidates.append((ver, sub))

    candidates.sort(key=lambda x: normalize_version(x[0]), reverse=True)
    return candidates

def install_package(name: str, constraint: str = None):
    versions = find_versions_in_cache(name)
    if not versions:
        return False
    # Prendre la version la plus récente
    ver, src = versions[0]
    target = NODE_MODULES / name
    if target.exists():
        return True
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, target, symlinks=True, ignore_dangling_symlinks=True)
        print(f"  ✓ {name}@{ver}")
        return True
    except Exception as e:
        print(f"  ❌ {name}: {e}")
        return False

def main():
    with open(PACKAGE_JSON) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get('dependencies', {}))
    deps.update(data.get('devDependencies', {}))

    print(f"=== Installation manuelle v2 — {len(deps)} paquets ===\n")
    NODE_MODULES.mkdir(parents=True, exist_ok=True)

    success = 0
    failed = []
    for name in deps:
        if install_package(name):
            success += 1
        else:
            failed.append(name)

    print(f"\n=== Bilan ===")
    print(f"  ✓ Installés: {success}")
    print(f"  ❌ Manquants: {len(failed)}")
    for f in failed:
        print(f"     - {f}")

    # Créer les binaires
    bin_dir = NODE_MODULES / '.bin'
    bin_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n=== Binaires ===")
    for binary in ['next', 'eslint', 'prisma', 'tsc']:
        for ext in ['', '.js', '.cjs', '.mjs']:
            src = NODE_MODULES / binary / 'bin' / f'{binary}{ext}'
            if src.exists():
                dst = bin_dir / binary
                try:
                    if dst.exists() or dst.is_symlink():
                        dst.unlink()
                    os.symlink(src, dst)
                    os.chmod(dst, 0o755)
                    print(f"  ✓ .bin/{binary}")
                except Exception as e:
                    print(f"  ⚠️ .bin/{binary}: {e}")
                break

if __name__ == '__main__':
    main()
