import math

def calculate_roof_area(length: float, width: float) -> dict:
    try:
        area = length * width
        return {"area": f"{area:.2f} m²"}
    except Exception as e:
        return {"error": str(e)}
