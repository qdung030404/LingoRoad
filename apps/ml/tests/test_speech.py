from lingoroad_ml.speech.scoring import word_scores, fluency_from_wpm
from lingoroad_ml.serving.speech_routes import _valid_signature

def test_perfect_match_scores_one():
    s = word_scores("I have lived here for two years", "I have lived here for two years")
    assert s["accuracy"] == 1.0 and s["completeness"] == 1.0 and s["missing_words"] == []

def test_missing_words_lower_accuracy_and_are_listed():
    s = word_scores("I have lived here for two years", "I lived here two years")
    assert 0 < s["accuracy"] < 1
    assert "have" in s["missing_words"] and "for" in s["missing_words"]

def test_case_and_punctuation_ignored():
    s = word_scores("Hello, world!", "hello world")
    assert s["accuracy"] == 1.0

def test_fluency_peaks_in_natural_range_and_clamps():
    assert fluency_from_wpm(130) == 1.0
    assert 0 <= fluency_from_wpm(30) < 1.0
    assert 0 <= fluency_from_wpm(300) < 1.0
    assert fluency_from_wpm(0) == 0.0

def test_digits_match_spelled_numbers():
    s = word_scores("I have lived here for two years", "I have lived here for 2 years")
    assert s["accuracy"] == 1.0 and s["missing_words"] == []

def test_contractions_match_expanded_forms():
    s = word_scores("I have not been there", "I haven't been there")
    assert s["accuracy"] == 1.0 and s["missing_words"] == []

def test_empty_transcript_scores_zero():
    s = word_scores("hello world", "")
    assert s["accuracy"] == 0.0 and s["completeness"] == 0.0
    assert s["missing_words"] == ["hello", "world"]

def test_repeated_words_count_each_occurrence():
    s = word_scores("I really really like it", "I really like it")
    assert s["missing_words"] == ["really"]

def test_audio_signature_must_match_declared_mime():
    webm = b"\x1a\x45\xdf\xa3payload"
    assert _valid_signature("audio/webm", webm)
    assert not _valid_signature("audio/wav", webm)
    assert not _valid_signature("application/octet-stream", webm)
