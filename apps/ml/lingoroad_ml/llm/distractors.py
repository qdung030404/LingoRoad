"""WordNet-based distractors: related-but-wrong words (synonyms of other senses,
antonyms, co-hyponyms). Requires: nltk.download('wordnet').
Note: adjectives mostly yield antonyms only (WordNet adjectives have no
hypernyms), so results are often fewer than n."""
from nltk.corpus import wordnet as wn

def wordnet_distractors(word: str, n: int = 3) -> list[str]:
    if n <= 0:
        return []
    word = word.lower()
    pool: list[str] = []
    for syn in wn.synsets(word):
        for lemma in syn.lemmas():
            if lemma.antonyms():
                pool.extend(a.name() for a in lemma.antonyms())
        for hyper in syn.hypernyms():
            for hypo in hyper.hyponyms():          # co-hyponyms: same category, wrong word
                pool.extend(l.name() for l in hypo.lemmas())
    seen, out = set(), []
    for w in pool:
        w = w.replace("_", " ").lower()
        if w != word and w not in seen and " " not in w:
            seen.add(w); out.append(w)
        if len(out) == n:
            break
    return out
