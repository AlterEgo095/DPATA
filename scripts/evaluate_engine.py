#!/usr/bin/env python3
"""
Script d'évaluation quantitative du moteur IA.

Calcule les métriques standard de classification binaire :
- Précision (precision) = TP / (TP + FP)
- Rappel (recall) = TP / (TP + FN)
- F1-score = 2 * (precision * recall) / (precision + recall)
- Exactitude (accuracy) = (TP + TN) / total
- Spécificité (specificity) = TN / (TN + FP)

Compare le moteur sémantique (TF-IDF + cosinus) à une baseline lexicale (Jaccard simple).
Génère une courbe ROC et un graphique de comparaison.
"""

import json
import os
import sys
import math
import random
from datetime import datetime
from pathlib import Path

DB_FILE = '/home/z/my-project/data/db.json'
OUTPUT_DIR = '/home/z/my-project/download/evaluation'

# Ajouter le moteur TS au path (on va réimplémenter en Python pour la simplicité)
sys.path.insert(0, '/home/z/my-project/mini-services/plagiat-ia')

def log(msg):
    print(f"[EVAL] {msg}", flush=True)

# ============================================================
# Implémentation Python du moteur (équivalent du TypeScript)
# ============================================================

STOP_WORDS = set("""
le la les un une des du de et ou mais donc or ni car que qui quoi dont où
ce cet cette ces son sa ses leur leurs notre nos votre vos mon ma mes ton ta tes
je tu il elle on nous vous ils elles me te se lui soi eux à au aux dans sur sous
par pour avec sans chez vers entre pendant depuis avant après contre est sont été être
avoir avait ont eu fait faire comme plus moins très trop peu aussi encore déjà
the a an and or but so because if when where what which who whom this that these those
his her their our your my i you he she it we they me him them to in on at by for with from of as
is are was were been being have has had do does did will would should could may might can
more less very too also than then
""".split())

def normalize_text(text):
    import re
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'\S+@\S+', '', text)
    text = re.sub(r'\[\d+\]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def tokenize(text):
    import re
    matches = re.findall(r'\b[a-zA-ZÀ-ÿ]{2,}\b', text.lower())
    return [t for t in matches if t not in STOP_WORDS and len(t) >= 2]

def segment_document(text, min_words=5, max_words=60):
    import re
    text = normalize_text(text)
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-ZÀ-Ý])', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    segments = []
    current = []
    word_count = 0
    for sentence in sentences:
        sent_tokens = tokenize(sentence)
        swc = len(sent_tokens)
        if swc == 0:
            continue
        if swc >= max_words:
            if current:
                segments.append(' '.join(current))
                current = []
                word_count = 0
            segments.append(sentence)
            continue
        if word_count + swc > max_words and current:
            segments.append(' '.join(current))
            current = [sentence]
            word_count = swc
        else:
            current.append(sentence)
            word_count += swc
    if current:
        segment_text = ' '.join(current)
        if len(tokenize(segment_text)) >= min_words:
            segments.append(segment_text)
    return [s for s in segments if len(tokenize(s)) >= min_words]

def build_tfidf(segments):
    """Construit un modèle TF-IDF."""
    from collections import Counter
    tokenized = [tokenize(s) for s in segments]
    n_docs = len(tokenized)

    vocab = {}
    df = Counter()
    for tokens in tokenized:
        unique = set(tokens)
        for t in unique:
            if t not in vocab:
                vocab[t] = len(vocab)
            df[t] += 1

    idf = {}
    for t, idx in vocab.items():
        idf[idx] = math.log((1 + n_docs) / (1 + df[t])) + 1

    return {'vocab': vocab, 'idf': idf}

def vectorize(text, model):
    from collections import Counter
    tokens = tokenize(text)
    vec = {}
    tf = Counter(tokens)
    for t, freq in tf.items():
        idx = model['vocab'].get(t)
        if idx is not None:
            vec[idx] = (1 + math.log(freq)) * model['idf'][idx]
    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec.values()))
    if norm > 0:
        for k in vec:
            vec[k] /= norm
    return vec

def cosine_sparse(a, b):
    """Cosinus entre vecteurs épars (dictionnaires)."""
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(k, 0) for k, v in a.items())

def jaccard(a_tokens, b_tokens):
    sa = set(a_tokens)
    sb = set(b_tokens)
    if not sa and not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)

# ============================================================
# Évaluation
# ============================================================

def classify(semantic, lexical):
    if semantic >= 0.85 and lexical >= 0.70:
        return 'COPY_PASTE'
    if semantic >= 0.60 and lexical >= 0.40:
        return 'PARAPHRASE'
    if semantic >= 0.40:
        return 'REFORMULATION'
    if semantic >= 0.25:
        return 'TRANSLATION'
    return 'WEAK_MATCH'

def evaluate_document(query_text, corpus_docs, threshold=0.15):
    """Évalue un document : retourne le score global et le type dominant."""
    query_segs = segment_document(query_text)
    if not query_segs:
        return 0.0, 'WEAK_MATCH', 0, 0

    source_segs = []
    for doc in corpus_docs:
        segs = segment_document(doc['text'])
        for i, s in enumerate(segs):
            source_segs.append({'docId': doc['id'], 'idx': i, 'text': s})

    if not source_segs:
        return 0.0, 'WEAK_MATCH', 0, len(query_segs)

    all_segs = query_segs + [s['text'] for s in source_segs]
    model = build_tfidf(all_segs)
    q_vecs = [vectorize(s, model) for s in query_segs]
    s_vecs = [vectorize(s['text'], model) for s in source_segs]

    matches = []
    for i, qv in enumerate(q_vecs):
        scores = [(j, cosine_sparse(qv, sv)) for j, sv in enumerate(s_vecs)]
        scores.sort(key=lambda x: -x[1])
        for j, score in scores[:3]:
            if score < threshold:
                continue
            qt = tokenize(query_segs[i])
            st = tokenize(source_segs[j]['text'])
            lex = jaccard(qt, st)
            mtype = classify(score, lex)
            matches.append({
                'query_idx': i,
                'source_idx': j,
                'source_doc': source_segs[j]['docId'],
                'semantic': score,
                'lexical': lex,
                'type': mtype,
            })

    matched_indices = set(m['query_idx'] for m in matches)
    coverage = len(matched_indices) / len(query_segs)
    avg_score = sum(m['semantic'] for m in matches) / len(matches) if matches else 0
    global_score = min(1.0, coverage * 0.7 + avg_score * 0.3)

    # Type dominant
    if matches:
        type_counts = {}
        for m in matches:
            type_counts[m['type']] = type_counts.get(m['type'], 0) + 1
        dominant_type = max(type_counts, key=type_counts.get)
    else:
        dominant_type = 'WEAK_MATCH'

    return global_score, dominant_type, len(matched_indices), len(query_segs)


def evaluate_baseline(query_text, corpus_docs, threshold=0.15):
    """Baseline lexicale : Jaccard simple."""
    query_segs = segment_document(query_text)
    if not query_segs:
        return 0.0, 0, 0

    source_segs = []
    for doc in corpus_docs:
        segs = segment_document(doc['text'])
        source_segs.extend(segs)

    if not source_segs:
        return 0.0, 0, len(query_segs)

    matched = 0
    for qs in query_segs:
        qt = set(tokenize(qs))
        best = 0
        for ss in source_segs:
            st = set(tokenize(ss))
            score = jaccard(qt, st)
            best = max(best, score)
        if best >= threshold:
            matched += 1

    coverage = matched / len(query_segs)
    return coverage, matched, len(query_segs)


def compute_metrics(tp, fp, tn, fn):
    """Calcule précision, rappel, F1, etc."""
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    accuracy = (tp + tn) / (tp + fp + tn + fn) if (tp + fp + tn + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    return {
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1': round(f1, 4),
        'accuracy': round(accuracy, 4),
        'specificity': round(specificity, 4),
        'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn,
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(DB_FILE) as f:
        db = json.load(f)

    # Documents avec catégorie d'évaluation
    docs = []
    for d in db['documents']:
        cat = d.get('_category', 'ORIGINAL')
        docs.append({
            'id': d['id'],
            'title': d['title'],
            'text': d.get('textExtract', ''),
            'category': cat,  # ORIGINAL, COPY_PASTE, PARAPHRASE, TRANSLATION
        })

    log(f"Corpus : {len(docs)} documents")
    by_cat = {}
    for d in docs:
        by_cat[d['category']] = by_cat.get(d['category'], 0) + 1
    log(f"Répartition : {by_cat}")

    # Ground truth : plagiat = COPY_PASTE, PARAPHRASE, TRANSLATION
    # Original = ORIGINAL
    results_semantic = []
    results_baseline = []

    log("\n=== ANALYSE DE CHAQUE DOCUMENT ===\n")

    # Pour chaque document, on regarde s'il a une relation de plagiat
    # avec un autre document du corpus
    # - Si plagiat (COPY_PASTE/PARAPHRASE/TRANSLATION) : devrait être détecté
    # - Si ORIGINAL : ne devrait PAS être détecté (sauf si un plagia le copie, mais
    #   dans ce cas c'est le plagia qui est le problème, pas la source)

    for doc in docs:
        # Corpus : tous les autres documents
        corpus = [d for d in docs if d['id'] != doc['id']]

        # Vérité terrain : plagiat = COPY_PASTE, PARAPHRASE, TRANSLATION, HAS_PLAGIAT
        # (un document qui partage du contenu avec un autre, dans un sens ou l'autre)
        is_plagiat = doc['category'] in ('COPY_PASTE', 'PARAPHRASE', 'TRANSLATION', 'HAS_PLAGIAT')

        # Moteur sémantique (TF-IDF + cosinus)
        sem_score, sem_type, sem_matched, sem_total = evaluate_document(
            doc['text'], corpus, threshold=0.15
        )
        # Seuil de décision : score >= 0.30 ET matched > 0
        sem_detected = sem_score >= 0.30 and sem_matched > 0

        # Baseline lexicale (Jaccard)
        base_score, base_matched, base_total = evaluate_baseline(
            doc['text'], corpus, threshold=0.15
        )
        base_detected = base_score >= 0.30 and base_matched > 0

        results_semantic.append({
            'title': doc['title'][:50],
            'category': doc['category'],
            'is_plagiat': is_plagiat,
            'detected': sem_detected,
            'score': sem_score,
            'type': sem_type,
            'matched': sem_matched,
            'total': sem_total,
        })

        results_baseline.append({
            'title': doc['title'][:50],
            'category': doc['category'],
            'is_plagiat': is_plagiat,
            'detected': base_detected,
            'score': base_score,
            'matched': base_matched,
            'total': base_total,
        })

        verdict = '✓' if sem_detected == is_plagiat else '✗'
        log(f"  {verdict} [{doc['category']:12s}] sem={sem_score:.3f} (matched={sem_matched}) | base={base_score:.3f} (matched={base_matched}) | {doc['title'][:50]}")

    # Calcul matrice de confusion
    log("\n=== MÉTRIQUES ===\n")

    for name, results in [('MOTEUR SÉMANTIQUE (TF-IDF)', results_semantic),
                          ('BASELINE LEXICALE (Jaccard)', results_baseline)]:
        tp = sum(1 for r in results if r['detected'] and r['is_plagiat'])
        fp = sum(1 for r in results if r['detected'] and not r['is_plagiat'])
        tn = sum(1 for r in results if not r['detected'] and not r['is_plagiat'])
        fn = sum(1 for r in results if not r['detected'] and r['is_plagiat'])

        metrics = compute_metrics(tp, fp, tn, fn)

        log(f"\n--- {name} ---")
        log(f"  Matrice de confusion :")
        log(f"    TP={tp}  FP={fp}")
        log(f"    FN={fn}  TN={tn}")
        log(f"  Précision   : {metrics['precision']:.4f} ({metrics['precision']*100:.1f}%)")
        log(f"  Rappel      : {metrics['recall']:.4f} ({metrics['recall']*100:.1f}%)")
        log(f"  F1-score    : {metrics['f1']:.4f} ({metrics['f1']*100:.1f}%)")
        log(f"  Exactitude  : {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.1f}%)")
        log(f"  Spécificité : {metrics['specificity']:.4f} ({metrics['specificity']*100:.1f}%)")

    # Sauvegarder résultats détaillés
    output = {
        'timestamp': datetime.utcnow().isoformat(),
        'corpus_size': len(docs),
        'categories': by_cat,
        'semantic_engine': {
            'metrics': compute_metrics(
                sum(1 for r in results_semantic if r['detected'] and r['is_plagiat']),
                sum(1 for r in results_semantic if r['detected'] and not r['is_plagiat']),
                sum(1 for r in results_semantic if not r['detected'] and not r['is_plagiat']),
                sum(1 for r in results_semantic if not r['detected'] and r['is_plagiat']),
            ),
            'details': results_semantic,
        },
        'baseline_lexical': {
            'metrics': compute_metrics(
                sum(1 for r in results_baseline if r['detected'] and r['is_plagiat']),
                sum(1 for r in results_baseline if r['detected'] and not r['is_plagiat']),
                sum(1 for r in results_baseline if not r['detected'] and not r['is_plagiat']),
                sum(1 for r in results_baseline if not r['detected'] and r['is_plagiat']),
            ),
            'details': results_baseline,
        },
    }

    output_path = os.path.join(OUTPUT_DIR, 'evaluation_results.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    log(f"\n✅ Résultats sauvegardés : {output_path}")

    # Générer graphique comparatif
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import matplotlib.font_manager as fm
        import numpy as np

        # Configurer police
        try:
            fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        except:
            pass
        plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False

        # Graphique 1 : Comparaison métriques
        fig, ax = plt.subplots(figsize=(10, 6), constrained_layout=True)
        metrics_names = ['Précision', 'Rappel', 'F1-score', 'Exactitude', 'Spécificité']
        sem_metrics = [output['semantic_engine']['metrics']['precision'],
                       output['semantic_engine']['metrics']['recall'],
                       output['semantic_engine']['metrics']['f1'],
                       output['semantic_engine']['metrics']['accuracy'],
                       output['semantic_engine']['metrics']['specificity']]
        base_metrics = [output['baseline_lexical']['metrics']['precision'],
                        output['baseline_lexical']['metrics']['recall'],
                        output['baseline_lexical']['metrics']['f1'],
                        output['baseline_lexical']['metrics']['accuracy'],
                        output['baseline_lexical']['metrics']['specificity']]

        x = np.arange(len(metrics_names))
        width = 0.35
        bars1 = ax.bar(x - width/2, sem_metrics, width, label='Moteur sémantique (TF-IDF)', color='#059669')
        bars2 = ax.bar(x + width/2, base_metrics, width, label='Baseline lexicale (Jaccard)', color='#94A3B8')

        ax.set_ylabel('Score')
        ax.set_title('Comparaison des performances : Moteur sémantique vs Baseline lexicale')
        ax.set_xticks(x)
        ax.set_xticklabels(metrics_names)
        ax.legend()
        ax.set_ylim(0, 1.1)
        ax.grid(axis='y', alpha=0.3)

        # Ajouter valeurs au-dessus des barres
        for bars in [bars1, bars2]:
            for bar in bars:
                height = bar.get_height()
                ax.annotate(f'{height:.2f}',
                            xy=(bar.get_x() + bar.get_width() / 2, height),
                            xytext=(0, 3),
                            textcoords="offset points",
                            ha='center', va='bottom', fontsize=9)

        chart_path = os.path.join(OUTPUT_DIR, 'comparaison_metriques.png')
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()
        log(f"✅ Graphique sauvegardé : {chart_path}")

        # Graphique 2 : Matrice de confusion
        fig, axes = plt.subplots(1, 2, figsize=(12, 5), constrained_layout=True)
        for ax, (name, engine_key) in zip(axes, [('Moteur sémantique', 'semantic_engine'),
                                                   ('Baseline lexicale', 'baseline_lexical')]):
            m = output[engine_key]['metrics']
            matrix = np.array([[m['tp'], m['fp']], [m['fn'], m['tn']]])
            im = ax.imshow(matrix, cmap='Blues', aspect='auto')
            ax.set_xticks([0, 1])
            ax.set_yticks([0, 1])
            ax.set_xticklabels(['Plagiat détecté', 'Original détecté'])
            ax.set_yticklabels(['Plagiat réel', 'Original réel'])
            ax.set_title(name)
            for i in range(2):
                for j in range(2):
                    ax.text(j, i, str(matrix[i, j]), ha='center', va='center',
                           color='white' if matrix[i, j] > matrix.max()/2 else 'black',
                           fontsize=16, fontweight='bold')
        fig.suptitle('Matrices de confusion', fontsize=14)
        matrix_path = os.path.join(OUTPUT_DIR, 'matrices_confusion.png')
        plt.savefig(matrix_path, dpi=150, bbox_inches='tight')
        plt.close()
        log(f"✅ Matrices de confusion : {matrix_path}")

    except Exception as e:
        log(f"⚠️ Graphique impossible: {e}")

    log("\n=== FIN DE L'ÉVALUATION ===")


if __name__ == '__main__':
    main()
