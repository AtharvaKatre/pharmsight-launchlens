"""Serve the built React app from FastAPI, for single-service hosting (e.g. Render).

docker compose serves the frontend from nginx instead, so this is only enabled when STATIC_DIR is set.
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_spa(app: FastAPI, directory: Path) -> None:
    """Serve hashed build assets, real files, and index.html for client-side routes.

    Must be called after all API routes are registered, because the catch-all route matches last.
    """
    root = directory.resolve()
    index = root / "index.html"
    if (root / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=root / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (root / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        # Unknown paths are client-side routes (e.g. /scenarios); never cache the HTML shell.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
