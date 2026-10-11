"""Word-level speaking scores from an expected prompt vs ASR transcript."""
import re
from difflib import SequenceMatcher

_CONTRACTIONS = [
    (re.compile(r"\bwon't\b"), "will not"),
    (re.compile(r"\bcan't\b"), "can not"),
    (re.compile(r"(\w+)n't\b"), r"\1 not"),
    (re.compile(r"(\w+)'re\b"), r"\1 are"),
    (re.compile(r"(\w+)'ve\b"), r"\1 have"),
    (re.compile(r"(\w+)'ll\b"), r"\1 will"),
    (re.compile(r"(\w+)'m\b"), r"\1 am"),
    (re.compile(r"(\w+)'d\b"), r"\1 would"),
]
_NUMBERS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
            "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
            "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
            "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
            "18": "eighteen", "19": "nineteen", "20": "twenty", "30": "thirty",
            "40": "forty", "50": "fifty", "60": "sixty", "70": "seventy",
            "80": "eighty", "90": "ninety", "100": "hundred"}

def _words(text: str) -> list[str]:
    text = text.lower()
    for pat, rep in _CONTRACTIONS:
        text = pat.sub(rep, text)
    return [_NUMBERS.get(t, t) for t in re.findall(r"[a-z']+|\d+", text)]

def word_scores(expected: str, transcript: str) -> dict:
    exp, got = _words(expected), _words(transcript)
    if not exp:
        return {"accuracy": 0.0, "completeness": 0.0, "missing_words": []}
    sm = SequenceMatcher(a=exp, b=got)
    matched_idx = set()
    for block in sm.get_matching_blocks():
        matched_idx.update(range(block.a, block.a + block.size))
    missing = [exp[i] for i in range(len(exp)) if i not in matched_idx]
    return {
        "accuracy": round(len(matched_idx) / len(exp), 3),
        "completeness": round(min(len(got) / len(exp), 1.0), 3),
        "missing_words": missing,
    }

def fluency_from_wpm(wpm: float) -> float:
    """1.0 in the natural 100-160 wpm band, tapering linearly outside."""
    if wpm <= 0:
        return 0.0
    if 100 <= wpm <= 160:
        return 1.0
    if wpm < 100:
        return round(wpm / 100.0, 3)
    return round(max(0.0, 1.0 - (wpm - 160) / 140.0), 3)
