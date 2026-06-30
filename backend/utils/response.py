from typing import Any


def success_response(data: Any = None, message: str = "success") -> dict:
    return {"code": 200, "message": message, "data": data}


def error_response(code: int = 400, message: str = "error") -> dict:
    return {"code": code, "message": message, "data": None}
