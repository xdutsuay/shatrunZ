from __future__ import annotations


def test_health_endpoint_includes_version():
    # Importing the Flask app is enough for a fast, deterministic test.
    from backend.server import app  # noqa: WPS433

    client = app.test_client()
    resp = client.get("/api/health")

    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"
    assert "version" in data
    assert isinstance(data["version"], str)

