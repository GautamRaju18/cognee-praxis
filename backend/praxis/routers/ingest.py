from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from praxis.db import get_session
from praxis.schemas import DecisionOut, IngestReport
from praxis.services import ingest_service

router = APIRouter(tags=["ingest"])

ALLOWED_SUFFIXES = (".txt", ".md")


@router.post("/ingest/document", response_model=IngestReport)
async def ingest_document(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
) -> IngestReport:
    if file is None and not text:
        raise HTTPException(422, "provide a .txt/.md file or a 'text' form field")
    if file is not None:
        name = (file.filename or "").lower()
        if not name.endswith(ALLOWED_SUFFIXES):
            raise HTTPException(422, f"only {ALLOWED_SUFFIXES} files are supported")
        raw = await file.read()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(422, "file must be UTF-8 text") from exc
    if not text or not text.strip():
        raise HTTPException(422, "document is empty")

    result = await ingest_service.ingest_document(session, text)
    return IngestReport(
        chars_ingested=result["chars_ingested"],
        decisions=[DecisionOut.model_validate(d) for d in result["decisions"]],
        extracted=result["extracted"],
    )
