const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new user
// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password, role, age, gender, dob, phone } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({ name, email, password, role, age, gender, dob, phone });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const { protect } = require('../middleware/authMiddleware');

// @desc    Update user profile
// @route   PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updateFields = {};

        // Handle email change with uniqueness check
        if (req.body.email && req.body.email !== user.email) {
            const emailExists = await User.findOne({ email: req.body.email });
            if (emailExists) {
                return res.status(400).json({ message: 'Email address already in use' });
            }
            updateFields.email = req.body.email;
        }

        if (req.body.age) updateFields.age = req.body.age;
        if (req.body.gender) updateFields.gender = req.body.gender;
        if (req.body.dob) updateFields.dob = req.body.dob;
        if (req.body.phone) updateFields.phone = req.body.phone;

        // Use findByIdAndUpdate to bypass the pre('save') password hash hook
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateFields },
            { new: true }
        ).select('-password');

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            age: updatedUser.age,
            gender: updatedUser.gender,
            dob: updatedUser.dob,
            phone: updatedUser.phone
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Reset password via DOB and Phone
// @route   POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    const { email, dob, phone, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // We format DOB to compare string parts (YYYY-MM-DD or similar logic)
        // Ensure that both dob and phone exist on user otherwise they cant reset
        if (!user.dob || !user.phone) {
            return res.status(400).json({ message: 'Profile incomplete, cannot reset password. Contact support.' });
        }

        const userDobString = new Date(user.dob).toISOString().split('T')[0];
        const inputDobString = new Date(dob).toISOString().split('T')[0];

        if (userDobString === inputDobString && user.phone === phone) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password reset successful' });
        } else {
            res.status(401).json({ message: 'Verification failed. Details do not match.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const CareRequest = require('../models/CareRequest');
const Medicine = require('../models/Medicine');
const IntakeLog = require('../models/IntakeLog');

// @desc    Delete own account
// @route   DELETE /api/auth/account
router.delete('/account', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'patient') {
            // Remove patient from their caretaker's list
            if (user.caretaker) {
                const caretaker = await User.findById(user.caretaker);
                if (caretaker) {
                    caretaker.patients = caretaker.patients.filter(pId => pId.toString() !== user._id.toString());
                    await caretaker.save();
                }
            }
            // Delete care requests targeted at this patient
            await CareRequest.deleteMany({ patientEmail: user.email });

            // Delete medicines and logs associated with this patient
            await IntakeLog.deleteMany({ patient: user._id });
            await Medicine.deleteMany({ patient: user._id });

        } else if (user.role === 'caretaker') {
            // Remove caretaker reference from all associated patients
            if (user.patients && user.patients.length > 0) {
                await User.updateMany(
                    { _id: { $in: user.patients } },
                    { $unset: { caretaker: "" } }
                );
            }
            // Delete care requests created by this caretaker
            await CareRequest.deleteMany({ caretaker: user._id });

            // Delete medicines scheduled by this caretaker
            const medicines = await Medicine.find({ caretaker: user._id });
            const medIds = medicines.map(m => m._id);
            await IntakeLog.deleteMany({ medicine: { $in: medIds } });
            await Medicine.deleteMany({ caretaker: user._id });
        }

        await User.findByIdAndDelete(req.user._id);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
