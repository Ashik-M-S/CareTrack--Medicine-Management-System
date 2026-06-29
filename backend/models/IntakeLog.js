const mongoose = require('mongoose');

const intakeLogSchema = mongoose.Schema({
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledTime: { type: String, required: true }, // "HH:mm"
    scheduledDate: { type: Date, required: true },
    status: { type: String, enum: ['taken', 'missed'], required: true },
    takenAt: { type: Date }
}, { timestamps: true });

const IntakeLog = mongoose.model('IntakeLog', intakeLogSchema);
module.exports = IntakeLog;
