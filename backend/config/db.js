const mongoose = require('mongoose');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dns = require('dns');

// Configure DNS resolution to prevent querySrv ECONNREFUSED errors on networks with poor SRV support
if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv')) {
    try {
        dns.setDefaultResultOrder('ipv4first');
        dns.setServers(['8.8.8.8', '8.8.4.4']);
    } catch (e) {
        // Fallback silently if DNS configuration isn't supported/permissions restrict it
    }
}

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
