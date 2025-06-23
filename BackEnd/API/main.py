from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# from routes import module
from services import roof_geometry_service
# from services import model_service


class Coordinate(BaseModel):
    lat: float
    lng: float

class PolygonRequest(BaseModel):
    coordinates: list[Coordinate]



# app.include_router(module.router, prefix="/module", tags=["Module"])
app.include_router(roof_geometry_service.router, prefix="/roof", tags=["Roof"])
# app.include_router(model_service.router, prefix="/model", tags=["Model"])

@app.get("/")
def read_root():
    return {"message": "Connected!"}


@app.post("/test")
async def receive_polygon(request: Request):
    body = await request.json()
    print("Received data:", body)
    return body