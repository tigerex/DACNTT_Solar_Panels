const express = require('express');
const router = express.Router();
const { calculateRoofArea } = require('../Controllers/ModuleControllers');


router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from the API!' });
});
// API: GET /api/area?length=10&width=5&angle=30 (Example)
router.get('/area', calculateRoofArea);

module.exports = router;
