"""多周期趋势路由 / Multi-timeframe trends router."""
import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Trend, User
from app.services.deps import get_current_user

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("", response_model=dict)
def list_trends(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取所有品种的最新多周期趋势快照 / list latest trend snapshots for all symbols."""
    rows = db.query(Trend).all()
    trends = []
    for r in rows:
        try:
            tf_map = json.loads(r.timeframes or "{}")
        except (ValueError, TypeError):
            tf_map = {}
        trends.append(
            {
                "symbol": r.symbol,
                "timeframes": tf_map,
                "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
            }
        )
    return {"trends": trends}
