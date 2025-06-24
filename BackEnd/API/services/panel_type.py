
# Kích thước tính bằng milimét hết nhé các fen
# Giá tính bằng đồng Việt Nam (VND)
# Công suất tính bằng watt (W)
# *Trong điều kiện tiêu chuẩn (STC), bức xạ mặt trời là 1000 W/m2, áp suất khí quyển 1.5 AM, nhiệt độ môi trường là 25oC
# *Trong điều kiện bình thường (NOCT), bức xạ mặt trời là 800 W/m2, áp suất khí quyển 1.5 AM, nhiệt độ môi trường là 20oC, tốc độ gió 1m/s
# QUyết định làm theo điều kiện nào ?
PANEL_TYPES = [

    # Cỡ phổ thông (400–600W)
    {
        "model": "Jinko Tiger Pro 540W",
        "width": 1.134,
        "height": 2.274,
        "best_power": 540,
        "normal_power": 402,
        "price_vnd": 3500000,
        "image": "jinko_540w.jpg"
    },
    {
        "model": "Trina Solar 545W",
        "width": 1.096,
        "height": 2.384,
        "best_power": 555,
        "normal_power": 420,
        "price_vnd": 1700000,
        "image": "trina_545w.jpg"
    },
    {
        "model": "JA Solar 550W",
        "width": 1.134,
        "height": 2.278,
        "best_power": 550,
        "normal_power": 416,
        "price_vnd": 1468500,
        "image": "ja_550w.jpg"
    },

    # Cỡ lớn (≥ 600W)
    {
        "model": "Canadian Solar 705W Bifacial",
        "width": 1.303,
        "height": 2.384,
        "best_power": 715,
        "normal_power": 541,
        "price_vnd": 2185500,
        "image": "canadian_705w.jpg"
    },
    {
        "model": "Longi Hi-MO6 615W",
        "width": 1.134,
        "height": 2.382,
        "best_power": 620,
        "normal_power": 464,
        "price_vnd": 2800000,
        "image": "longi_615w.jpg"
    },
    {
        "model": "Jinko Tiger Neo 635W",
        "width": 1.134,
        "height": 2.384,
        "best_power": 635,
        "normal_power": "unknown",  # Normal power not specified
        "price_vnd": 2950000,
        "image": "jinko_635w.jpg"
    }
]
