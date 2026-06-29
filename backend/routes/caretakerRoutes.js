const express = require('express');
const router = express.Router();
const User = require('../models/User');
const CareRequest = require('../models/CareRequest');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Search patient by email and send request
// @route   POST /api/caretaker/request
router.post('/request', protect, authorize('caretaker'), async (req, res) => {
    const { email } = req.body;

    try {
        const patient = await User.findOne({ email, role: 'patient' });
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        if (patient.caretaker) {
            return res.status(400).json({ message: 'Patient already has an assigned caretaker' });
        }

        const existingRequest = await CareRequest.findOne({
            caretaker: req.user._id,
            patientEmail: email,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'Request already sent' });
        }

        const careRequest = await CareRequest.create({
            caretaker: req.user._id,
            patientEmail: email,
            patient: patient._id
        });

        res.status(201).json(careRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get list of accepted patients
// @route   GET /api/caretaker/patients
router.get('/patients', protect, authorize('caretaker'), async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('patients', 'name email');
        res.json(user.patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Remove a patient
// @route   DELETE /api/caretaker/patient/:id
router.delete('/patient/:id', protect, authorize('caretaker'), async (req, res) => {
    try {
        const caretaker = await User.findById(req.user._id);
        const patient = await User.findById(req.params.id);

        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Remove from caretaker's list
        caretaker.patients = caretaker.patients.filter(pId => pId.toString() !== patient._id.toString());
        await caretaker.save();

        // Remove caretaker reference from patient
        patient.caretaker = undefined;
        await patient.save();

        // Delete related care requests
        await CareRequest.deleteMany({ caretaker: caretaker._id, patientEmail: patient.email });

        // Delete medicines scheduled by this caretaker for this patient
        await Medicine.deleteMany({ caretaker: caretaker._id, patient: patient._id });

        res.json({ message: 'Patient removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
