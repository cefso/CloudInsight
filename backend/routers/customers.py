from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Customer, CloudAccount
from schemas.customer import CustomerCreate, CustomerUpdate
from utils.response import success_response

router = APIRouter(prefix="/api/customers", tags=["客户管理"])


def _serialize_customer(
    customer: Customer,
    account_count: int = 0,
    account_names: list[str] | None = None,
) -> dict:
    return {
        "id": customer.id,
        "name": customer.name,
        "contact": customer.contact,
        "phone": customer.phone,
        "remark": customer.remark,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
        "account_count": account_count,
        "account_names": account_names or [],
    }


def _account_info(db: Session, customer_id: int) -> tuple[int, list[str]]:
    accounts = (
        db.query(CloudAccount.name)
        .filter(CloudAccount.customer_id == customer_id)
        .order_by(CloudAccount.name)
        .all()
    )
    names = [name for (name,) in accounts]
    return len(names), names


@router.get("")
def list_customers(db: Session = Depends(get_db)):
    customers = db.query(Customer).order_by(Customer.created_at.desc()).all()
    items = []
    for customer in customers:
        count, names = _account_info(db, customer.id)
        items.append(_serialize_customer(customer, count, names))
    return success_response(data=items)


@router.post("")
def create_customer(request: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.name == request.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="客户名称已存在")
    customer = Customer(
        name=request.name,
        contact=request.contact,
        phone=request.phone,
        remark=request.remark,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return success_response(data={"id": customer.id}, message="客户创建成功")


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    count, names = _account_info(db, customer.id)
    return success_response(data=_serialize_customer(customer, count, names))


@router.put("/{customer_id}")
def update_customer(customer_id: int, request: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    if request.name is not None and request.name != customer.name:
        existing = db.query(Customer).filter(Customer.name == request.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="客户名称已存在")
        customer.name = request.name
    if request.contact is not None:
        customer.contact = request.contact
    if request.phone is not None:
        customer.phone = request.phone
    if request.remark is not None:
        customer.remark = request.remark
    db.commit()
    return success_response(message="客户更新成功")


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    # 删除客户时保留云账号，仅解除归属
    db.query(CloudAccount).filter(CloudAccount.customer_id == customer_id).update(
        {CloudAccount.customer_id: None}
    )
    db.delete(customer)
    db.commit()
    return success_response(message="客户删除成功")
