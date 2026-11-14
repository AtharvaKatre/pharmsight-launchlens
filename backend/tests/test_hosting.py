"""Hosting helpers: database URL normalisation and serving the React build. No database needed."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import normalize_database_url
from app.spa import mount_spa


@pytest.mark.parametrize(
    "url, expected",
    [
        ("postgresql://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        ("postgres://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
    ],
)
def test_database_url_uses_psycopg_driver(url, expected):
    assert normalize_database_url(url) == expected


@pytest.fixture
def spa_client(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>app shell</html>")
    (tmp_path / "assets" / "index-abc.js").write_text("console.log('app')")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path.parent / "secret.txt").write_text("outside the build directory")

    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    mount_spa(app, tmp_path)
    return TestClient(app)


def test_api_routes_take_priority(spa_client):
    assert spa_client.get("/api/health").json() == {"status": "ok"}


def test_unknown_api_paths_are_404_not_the_app_shell(spa_client):
    assert spa_client.get("/api/does-not-exist").status_code == 404


def test_assets_and_files_are_served(spa_client):
    assert spa_client.get("/assets/index-abc.js").text == "console.log('app')"
    assert spa_client.get("/favicon.svg").text == "<svg/>"


@pytest.mark.parametrize("path", ["/", "/dashboard", "/versions/3"])
def test_client_side_routes_get_the_app_shell(spa_client, path):
    response = spa_client.get(path)

    assert response.status_code == 200
    assert response.text == "<html>app shell</html>"
    assert response.headers["cache-control"] == "no-cache"


def test_paths_outside_the_build_directory_are_not_served(spa_client):
    response = spa_client.get("/..%2Fsecret.txt")

    assert "outside the build directory" not in response.text
