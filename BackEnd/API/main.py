from fastapi import FastAPI
from routes import module

app = FastAPI()

app.include_router(module.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI backend!"}
