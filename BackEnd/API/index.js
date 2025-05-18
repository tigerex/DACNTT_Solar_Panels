const express = require('express');
const cors = require('cors');
const moduleRoutes = require('./Routes/Module');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Dùng một route duy nhất, rõ ràng
app.use('/api', moduleRoutes);

app.get('/', (req, res) => {
  res.send('Hello from Express backend!');
});

app.listen(PORT, () => {
  console.log(`\n=============  Server is running on http://localhost:${PORT} =============\n`);
});
