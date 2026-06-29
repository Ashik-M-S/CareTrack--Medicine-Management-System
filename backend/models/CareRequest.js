const mongoose = require('mongoose');

const careRequestSchema = mongoose.Schema({
    caretaker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    patientEmail: { type: String, required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Set once request is sent/found
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, { timestamps: true });

const CareRequest = mongoose.model('CareRequest', careRequestSchema);
module.exports = CareRequest;
