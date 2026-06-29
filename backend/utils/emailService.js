const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify transporter on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('⚠️  Email transporter verification failed:', error.message);
        console.error('   Make sure EMAIL_USER and EMAIL_PASS (Gmail App Password) are set correctly in .env');
        console.error('   To generate an App Password: Google Account → Security → 2-Step Verification → App Passwords');
    } else {
        console.log('✅ Email transporter is ready to send messages.');
    }
});

const sendEmail = async (to, subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}: "${subject}"`);
    } catch (error) {
        console.error(`❌ Error sending email to ${to}: ${error.message}`);
        console.log(`   [FALLBACK] Would have sent → To: ${to} | Subject: ${subject} | Body: ${text}`);
    }
};

module.exports = { sendEmail };
