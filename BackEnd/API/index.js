const express = require('express');
const cors = require('cors');
const userRoutes = require('./Routes/ModuleControllers'); // không cần .js

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/test', userRoutes);

app.get('/', (req, res) => {
  res.send('Hello from Express backend!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
