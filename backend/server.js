const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const caretakerRoutes = require('./routes/caretakerRoutes');
const patientRoutes = require('./routes/patientRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const noteRoutes = require('./routes/noteRoutes');
const startScheduler = require('./utils/scheduler');

const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/caretaker', caretakerRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/medicine', medicineRoutes);
app.use('/api/notes', noteRoutes);

// Catch-all route to serve the frontend for any non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`CareTrack Server: http://localhost:${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV}`);
    console.log('--------------------------------------------------');
    startScheduler();
});
