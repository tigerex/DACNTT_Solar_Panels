import math
from services.image_analysis_service import calculate_parallelogram_area

# Tính diện tích mái nhà hình chữ nhật hoặc bình hành dựa trên chiều dài, chiều rộng và góc nghiêng.
def calculate_roof_area(length: float, width: float) -> dict:
    try:
        area = length * width
        return {"area": f"{area:.2f} m²"}
    except Exception as e:
        return {"error": str(e)}

# Phân tích mái nhà: nếu góc lệch nhiều thì là mái nghiêng (hình bình hành).
def analyze_roof_shape(length: float, width: float, angle: float) -> dict:
    if 88 <= angle <= 92:
        shape = "rectangle"
        area = length * width
    else:
        shape = "parallelogram"
        area = calculate_parallelogram_area(length, width, angle)

    return {
        "shape": shape,
        "area": f"{area:.2f} m²"
    }
