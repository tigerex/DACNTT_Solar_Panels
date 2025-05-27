from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import module
from services import roof_geometry_service
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(module.router, prefix="/module", tags=["Module"])
app.include_router(roof_geometry_service.router, prefix="/roof", tags=["Roof"])

@app.get("/")
def read_root():
    return {"message": "Connected!"}
