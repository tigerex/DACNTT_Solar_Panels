from fastapi import APIRouter
from controllers.module_controllers import calculate_roof_area


router = APIRouter()

@router.get("/hello")
def hello():
    return {"message": "Hello from the API!"}

@router.get("/area")
def area(length: float, width: float):
    return calculate_roof_area(length, width)
