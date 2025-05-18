const express = require('express');
const cors = require('cors');
const moduleRoutes = require('./Routes/Module'); // ✅ sửa lại đúng file: Module.js

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Dùng một route duy nhất, rõ ràng
app.use('/api', moduleRoutes);

app.get('/', (req, res) => {
  res.send('Hello from Express backend!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
