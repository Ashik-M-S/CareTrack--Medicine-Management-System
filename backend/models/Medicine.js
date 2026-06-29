const mongoose = require('mongoose');

const medicineSchema = mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caretaker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    intakeTimes: [{ type: String, required: true }], // Format: "HH:mm"
    startDate: { type: Date, required: true },
    duration: { type: Number, required: true }, // in days
    active: { type: Boolean, default: true }
}, { timestamps: true });

const Medicine = mongoose.model('Medicine', medicineSchema);
module.exports = Medicine;
