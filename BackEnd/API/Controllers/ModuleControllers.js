const express = require('express');
const cors = require('cors');

// Controllers/Module.js

// Hàm tính diện tích mái nhà có góc nghiêng
const calculateRoofArea = (req, res) => {
    const { length, width, angle } = req.query;

    try {
        if (!length || !width) {
            return res.status(400).json({ error: "Thiếu chiều dài hoặc chiều rộng" });
        }

        const lengthVal = parseFloat(length);
        const widthVal = parseFloat(width);
        const angleVal = angle ? parseFloat(angle) : 0;

        const radians = angleVal * (Math.PI / 180);
        const realWidth = widthVal / Math.cos(radians);

        const area = lengthVal * realWidth;
        res.json({ area: `${area.toFixed(2)} m²` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    calculateRoofArea
};
