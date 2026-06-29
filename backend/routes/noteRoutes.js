const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const HealthNote = require('../models/HealthNote');
const User = require('../models/User');

// @desc    Create a health note for a patient
// @route   POST /api/notes
router.post('/', protect, async (req, res) => {
    const { patientId, description, scheduledDate, scheduledTime } = req.body;

    try {
        // Verify the caretaker has access to this patient
        const caretaker = await User.findById(req.user._id);
        if (!caretaker || caretaker.role !== 'caretaker') {
            return res.status(403).json({ message: 'Only caretakers can create health notes.' });
        }

        const isPatient = caretaker.patients.some(p => p.toString() === patientId);
        if (!isPatient) {
            return res.status(403).json({ message: 'This patient is not under your care.' });
        }

        const note = await HealthNote.create({
            patient: patientId,
            caretaker: req.user._id,
            description,
            scheduledDate,
            scheduledTime
        });

        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all health notes for a specific patient (for caretaker)
// @route   GET /api/notes/patient/:patientId
router.get('/patient/:patientId', protect, async (req, res) => {
    try {
        const notes = await HealthNote.find({ patient: req.params.patientId })
            .sort({ scheduledDate: 1, scheduledTime: 1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all health notes for the logged-in patient
// @route   GET /api/notes/my
router.get('/my', protect, async (req, res) => {
    try {
        const notes = await HealthNote.find({ patient: req.user._id })
            .populate('caretaker', 'name')
            .sort({ scheduledDate: 1, scheduledTime: 1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete a health note
// @route   DELETE /api/notes/:id
router.delete('/:id', protect, async (req, res) => {
    try {
        const note = await HealthNote.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ message: 'Note not found.' });
        }

        // Only the caretaker who created it can delete
        if (note.caretaker.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this note.' });
        }

        await HealthNote.findByIdAndDelete(req.params.id);
        res.json({ message: 'Note deleted.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
