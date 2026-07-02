import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import CloudAccount
from schemas.cloud_account import (
    CloudAccountCreate, CloudAccountUpdate, TestConnectionRequest
)
from utils.response import success_response
from services.crypto import crypto_service
from services.aliyun_client import AliyunClient

router = APIRouter(prefix="/api/accounts", tags=["账号管理"])


def _serialize_account(account: CloudAccount) -> dict:
    """序列化账号信息，脱敏 AK"""
    return {
        "id": account.id,
        "name": account.name,
        "access_key_id": crypto_service.mask_ak(account.access_key_id),
        "regions": json.loads(account.regions) if account.regions else None,
        "resource_types": json.loads(account.resource_types) if account.resource_types else None,
        "is_enabled": account.is_enabled,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


@router.get("")
def list_accounts(db: Session = Depends(get_db)):
    accounts = db.query(CloudAccount).order_by(CloudAccount.created_at.desc()).all()
    return success_response(data=[_serialize_account(a) for a in accounts])


@router.post("")
def create_account(request: CloudAccountCreate, db: Session = Depends(get_db)):
    encrypted_secret = crypto_service.encrypt(request.access_key_secret)
    account = CloudAccount(
        name=request.name,
        access_key_id=request.access_key_id,
        access_key_secret=encrypted_secret,
        regions=json.dumps(request.regions) if request.regions else None,
        resource_types=json.dumps(request.resource_types) if request.resource_types else None,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return success_response(data={"id": account.id}, message="账号创建成功")


@router.get("/{account_id}")
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    return success_response(data=_serialize_account(account))


@router.put("/{account_id}")
def update_account(account_id: int, request: CloudAccountUpdate, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    if request.name is not None:
        account.name = request.name
    if request.access_key_id is not None and "***" not in request.access_key_id:
        account.access_key_id = request.access_key_id
    if request.access_key_secret is not None:
        if "***" not in request.access_key_secret:
            account.access_key_secret = crypto_service.encrypt(request.access_key_secret)
    if request.regions is not None:
        account.regions = json.dumps(request.regions)
    if request.resource_types is not None:
        account.resource_types = json.dumps(request.resource_types)
    if request.is_enabled is not None:
        account.is_enabled = request.is_enabled
    db.commit()
    return success_response(message="账号更新成功")


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    db.delete(account)
    db.commit()
    return success_response(message="账号删除成功")


@router.post("/{account_id}/test")
def test_connection(account_id: int, db: Session = Depends(get_db)):
    account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="账号不存在")
    ak = account.access_key_id
    sk = crypto_service.decrypt(account.access_key_secret)
    regions = json.loads(account.regions) if account.regions else ["cn-hangzhou"]
    client = AliyunClient(ak, sk, regions[0])
    result = client.test_connection()
    return success_response(data=result)


@router.post("/test")
def test_connection_direct(request: TestConnectionRequest):
    # 限制直接测试接口：AK/SK 格式校验
    if not request.access_key_id or len(request.access_key_id) < 10:
        raise HTTPException(status_code=400, detail="access_key_id 格式不正确")
    if not request.access_key_secret or len(request.access_key_secret) < 10:
        raise HTTPException(status_code=400, detail="access_key_secret 格式不正确")
    client = AliyunClient(request.access_key_id, request.access_key_secret, request.region)
    result = client.test_connection()
    return success_response(data=result)
