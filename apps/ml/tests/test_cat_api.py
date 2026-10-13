from fastapi.testclient import TestClient
from lingoroad_ml.serving.app import app

client = TestClient(app)

def test_cat_select_returns_theta_and_next_item():
    body = {
        "history": [{"a": 1.0, "b": 0.0, "c": 0.25, "correct": True}],
        "candidates": [
            {"item_id": "11111111-1111-1111-1111-111111111111", "a": 1.2, "b": 0.3, "c": 0.25},
            {"item_id": "22222222-2222-2222-2222-222222222222", "a": 1.2, "b": -2.5, "c": 0.25},
        ],
    }
    r = client.post("/cat/select", json=body)
    assert r.status_code == 200
    data = r.json()
    assert {"theta", "se", "next_item_id"} <= data.keys()
    assert data["next_item_id"] == "11111111-1111-1111-1111-111111111111"

def test_cat_select_empty_candidates_returns_null_item():
    r = client.post("/cat/select", json={"history": [], "candidates": []})
    assert r.status_code == 200
    assert r.json()["next_item_id"] is None

def test_internal_token_is_required_when_configured(monkeypatch):
    monkeypatch.setenv("LINGOROAD_ML_INTERNAL_TOKEN", "t" * 32)
    body = {"history": [], "candidates": []}
    assert client.post("/cat/select", json=body).status_code == 401
    response = client.post(
        "/cat/select", json=body, headers={"X-Internal-Token": "t" * 32}
    )
    assert response.status_code == 200

def test_readiness_reports_each_component(monkeypatch):
    monkeypatch.setenv("LINGOROAD_ML_REQUIRED_MODELS", "cat")
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert {"cat", "llm", "rag", "speech", "kt"} <= data["components"].keys()
