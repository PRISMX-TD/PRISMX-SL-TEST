"""信号路由 / Signals router."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Signal, User
from app.schemas import SignalOut
from app.services.deps import get_current_user

router = APIRouter(prefix="/signals", tags=["signals"])


def _expire_stale(db: Session) -> None:
    """把已过有效期但仍标记 ACTIVE 的信号置为 EXPIRED。
    Mark ACTIVE signals past their expiry as EXPIRED.
    """
    now = datetime.now(timezone.utc)
    active = (
        db.query(Signal)
        .filter(Signal.status == "ACTIVE", Signal.expire_at.isnot(None))
        .all()
    )
    changed = False
    for s in active:
        exp = s.expire_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            s.status = "EXPIRED"
            changed = True
    if changed:
        db.commit()


@router.get("", response_model=dict)
def list_signals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取信号列表（最新在前）/ list signals, newest first."""
    _expire_stale(db)
    rows = db.query(Signal).order_by(Signal.created_at.desc()).limit(50).all()
    signals = [
        SignalOut(
            id=s.id,
            symbol=s.symbol,
            side=s.side,
            entry=s.entry,
            stopLoss=s.stop_loss,
            takeProfit=s.take_profit,
            indicator=s.indicator,
            status=s.status,
            createdAt=s.created_at,
            expireAt=s.expire_at,
        )
        for s in rows
    ]
    return {"signals": signals}
