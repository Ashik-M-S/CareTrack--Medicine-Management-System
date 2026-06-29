const express = require('express');
const router = express.Router();
const User = require('../models/User');
const CareRequest = require('../models/CareRequest');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get care requests
// @route   GET /api/patient/requests
router.get('/requests', protect, authorize('patient'), async (req, res) => {
    try {
        const requests = await CareRequest.find({
            patientEmail: req.user.email,
            status: 'pending'
        }).populate('caretaker', 'name email');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Accept/Reject care request
// @route   PUT /api/patient/request/:id
router.put('/request/:id', protect, authorize('patient'), async (req, res) => {
    const { status } = req.body; // 'accepted' or 'rejected'

    try {
        const careRequest = await CareRequest.findById(req.params.id);
        if (!careRequest) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (careRequest.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }

        careRequest.status = status;
        await careRequest.save();

        if (status === 'accepted') {
            const caretaker = await User.findById(careRequest.caretaker);
            const patient = await User.findById(req.user._id);

            if (!caretaker || !patient) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Update patient
            patient.caretaker = caretaker._id;
            await patient.save();

            // Update caretaker - only push if not already exists
            if (!caretaker.patients.includes(patient._id)) {
                caretaker.patients.push(patient._id);
                await caretaker.save();
            }

            // Auto-reject other pending requests for this patient
            await CareRequest.updateMany(
                { patientEmail: patient.email, status: 'pending', _id: { $ne: careRequest._id } },
                { $set: { status: 'rejected' } }
            );
        }

        res.json(careRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get my caretaker details
// @route   GET /api/patient/caretaker
router.get('/caretaker', protect, authorize('patient'), async (req, res) => {
    try {
        const patient = await User.findById(req.user._id).populate('caretaker', 'name email phone gender age');
        if (!patient || !patient.caretaker) {
            return res.status(404).json({ message: 'Caretaker not found or not assigned yet.' });
        }
        res.json(patient.caretaker);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
