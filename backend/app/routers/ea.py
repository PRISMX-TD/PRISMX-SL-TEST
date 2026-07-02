"""API Token 路由：网页端查看/重置连接 MT5 所用的专属 Token。
API token router: view/reset the per-user token used to connect MT5.

历史上本路由还承载 EA 的账号登记、后缀与在线状态端点；EA 接入方式已移除，
MT5 统一经 PRISMX Bridge 接入（多账号与后缀见 /api/bridge/*）。
Historically this router also served the EA's account registration, suffix and
status endpoints. The EA integrations have been removed; MT5 connects solely
via the PRISMX Bridge (accounts & suffix live under /api/bridge/*).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import generate_api_token
from app.models import MT5Account, User
from app.schemas import EATokenOut
from app.services.deps import get_current_user

router = APIRouter(prefix="/ea", tags=["ea"])


def _primary_login(db: Session, user_id: str) -> str | None:
    """取第一个已上报账号作为展示用主账号 / first reported account for display."""
    acc = (
        db.query(MT5Account)
        .filter(MT5Account.user_id == user_id)
        .order_by(MT5Account.login.asc())
        .first()
    )
    return acc.login if acc else None


@router.get("/token", response_model=EATokenOut)
def get_token(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前用户的 API Token 与主账号 / get API token and primary account."""
    return EATokenOut(apiToken=user.api_token, boundAccount=_primary_login(db, user.id))


@router.post("/token/reset", response_model=EATokenOut)
def reset_token(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """重置 API Token（旧 Token 立即失效）/ reset API token (old token invalidated)."""
    user.api_token = generate_api_token()
    db.commit()
    db.refresh(user)
    return EATokenOut(apiToken=user.api_token, boundAccount=_primary_login(db, user.id))
