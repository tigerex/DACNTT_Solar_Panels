from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from controllers.module_controllers import calculate_area_from_coordinates

router = APIRouter()

class Coordinate(BaseModel):
    lat: float
    lng: float

class PolygonRequest(BaseModel):
    coordinates: List[Coordinate]

@router.post("/calc-area-from-coords")
def calc_area_from_coords(polygon: PolygonRequest):
    coords = [(c.lng, c.lat) for c in polygon.coordinates]
    return calculate_area_from_coordinates(coords)
