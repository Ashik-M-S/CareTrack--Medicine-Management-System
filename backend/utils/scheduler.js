const cron = require('node-cron');
const Medicine = require('../models/Medicine');
const IntakeLog = require('../models/IntakeLog');
const User = require('../models/User');
const { sendEmail } = require('./emailService');

const startScheduler = () => {
    // 1. Minute-level Reminders (node-cron)
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        try {
            const medicines = await Medicine.find({ active: true }).populate('patient caretaker');
            for (const med of medicines) {
                if (med.intakeTimes.includes(currentTime)) {
                    // Send reminder
                    const subject = `Medicine Reminder: ${med.name}`;
                    const text = `Hi ${med.patient.name}, it's time to take your dose of ${med.name} (${med.dosage}).`;
                    await sendEmail(med.patient.email, subject, text);
                    await sendEmail(med.caretaker.email, `Patient Reminder: ${med.name}`, `${med.patient.name} has a scheduled dose of ${med.name} now.`);
                }
            }
        } catch (error) {
            console.error(`Reminder Scheduler Error: ${error.message}`);
        }
    });

    // 2. High-Frequency Missed Dose Detection (Every 10 seconds)
    setInterval(async () => {
        const now = new Date();
        const seconds = now.getSeconds();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // We only check for missed doses if we are > 30 seconds into the minute
        if (seconds >= 30) {
            try {
                const medicines = await Medicine.find({ active: true }).populate('patient caretaker');
                for (const med of medicines) {
                    if (med.intakeTimes.includes(currentTime)) {
                        const existingLog = await IntakeLog.findOne({
                            medicine: med._id,
                            scheduledTime: currentTime,
                            scheduledDate: today
                        });

                        if (!existingLog) {
                            // Automatically mark as missed after 30 seconds
                            await IntakeLog.create({
                                medicine: med._id,
                                patient: med.patient._id,
                                scheduledTime: currentTime,
                                scheduledDate: today,
                                status: 'missed'
                            });

                            // Notify caretaker
                            await sendEmail(med.caretaker.email, `MISSED DOSE: ${med.patient.name}`, `${med.patient.name} missed their dose of ${med.name} scheduled at ${currentTime}.`);
                            console.log(`[AUTOLOG] Missed dose recorded for ${med.patient.name} - ${med.name} at ${currentTime}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`Missed Dose Detection Error: ${error.message}`);
            }
        }
    }, 10000); // Check every 10 seconds
};

module.exports = startScheduler;
