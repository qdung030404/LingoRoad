import pytest
from fastapi import HTTPException
from lingoroad_ml.speech.topic import aggregate


def payload(duration, accuracy, prosody=50):
    return {"Duration": duration * 10_000_000, "NBest": [{"Display": "Hello.",
        "PronunciationAssessment": {"AccuracyScore": accuracy, "FluencyScore": 80,
            "ProsodyScore": prosody, "PronScore": 70},
        "Words": [{"Word": "Hello", "Offset": 0, "Duration": 1_000_000,
            "PronunciationAssessment": {"AccuracyScore": accuracy}}]}]}


def test_duration_weighted_topic_scores_keep_original_utterances():
    result = aggregate([payload(1, 40), payload(3, 80)], 5, "a" * 64)
    assert result["accuracy"] == 70
    assert result["overall"] == pytest.approx((40 * 70 + 25 * 80 + 25 * 50) / 90)
    assert result["utterances"][0]["accuracy"] == 40
    assert result["schemaVersion"] == 3
    assert "completeness" not in result


def test_missing_prosody_is_partial_without_fabricated_total():
    result = aggregate([payload(1, 80, None)], 2, "a" * 64)
    assert result["prosody"] is None
    assert result["overall"] is None
    assert result["assessmentCompleteness"] == "partial"


def test_empty_or_invalid_topic_results_fail():
    for data in [[], [{}], [payload(0, 80)], [payload(1, 101)]]:
        with pytest.raises(HTTPException):
            aggregate(data, 2, "a" * 64)


def test_sdk_break_confidence_preserves_provider_values_above_one():
    data = payload(1, 80)
    data["NBest"][0]["Words"][0]["PronunciationAssessment"]["Feedback"] = {
        "Prosody": {"Break": {"UnexpectedBreak": {"Confidence": 4.232258}}}}
    result = aggregate([data], 2, "a" * 64)
    assert result["words"][0]["prosody"]["unexpectedBreakConfidence"] == 4.232258
