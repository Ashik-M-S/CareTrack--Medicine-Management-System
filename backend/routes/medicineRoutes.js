const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const IntakeLog = require('../models/IntakeLog');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Add a new medicine
// @route   POST /api/medicine
router.post('/', protect, authorize('caretaker'), async (req, res) => {
    const { patientId, name, dosage, intakeTimes, startDate, duration } = req.body;

    try {
        const medicine = await Medicine.create({
            patient: patientId,
            caretaker: req.user._id,
            name,
            dosage,
            intakeTimes,
            startDate,
            duration
        });
        res.status(201).json(medicine);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get medicines for a patient
// @route   GET /api/medicine/patient/:id
router.get('/patient/:id', protect, async (req, res) => {
    try {
        const medicines = await Medicine.find({ patient: req.params.id, active: true });
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update a medicine
// @route   PUT /api/medicine/:id
router.put('/:id', protect, authorize('caretaker'), async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine || medicine.caretaker.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Medicine not found or unauthorized' });
        }

        const updatedMedicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedMedicine);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Delete a medicine
// @route   DELETE /api/medicine/:id
router.delete('/:id', protect, authorize('caretaker'), async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine || medicine.caretaker.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Medicine not found or unauthorized' });
        }

        await IntakeLog.deleteMany({ medicine: req.params.id });
        await Medicine.findByIdAndDelete(req.params.id);
        res.json({ message: 'Medicine removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark medicine as consumed
// @route   POST /api/medicine/consume
router.post('/consume', protect, authorize('caretaker'), async (req, res) => {
    const { medicineId, scheduledTime, scheduledDate } = req.body;

    try {
        const medicine = await Medicine.findById(medicineId);
        if (!medicine || medicine.caretaker.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Medicine not found or unauthorized' });
        }

        let log = await IntakeLog.findOne({
            medicine: medicineId,
            scheduledTime,
            scheduledDate
        });

        if (log) {
            log.status = 'taken';
            log.takenAt = new Date();
            await log.save();
        } else {
            log = await IntakeLog.create({
                medicine: medicineId,
                patient: medicine.patient,
                scheduledTime,
                scheduledDate,
                status: 'taken',
                takenAt: new Date()
            });
        }
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all logs for a patient's medicines
// @route   GET /api/medicine/patient/:id/logs
router.get('/patient/:id/logs', protect, async (req, res) => {
    try {
        const logs = await IntakeLog.find({ patient: req.params.id })
            .populate('medicine', 'name dosage startDate duration')
            .sort({ scheduledDate: -1, scheduledTime: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
