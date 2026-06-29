const mongoose = require('mongoose');

const healthNoteSchema = mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caretaker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true }, // e.g. "Test sugar level", "Check BP"
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true } // Format: "HH:mm"
}, { timestamps: true });

const HealthNote = mongoose.model('HealthNote', healthNoteSchema);
module.exports = HealthNote;
