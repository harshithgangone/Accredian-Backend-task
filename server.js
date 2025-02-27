// server.js
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { body, validationResult } from 'express-validator';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure email transporter with simple authentication
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// Send email notification
const sendReferralEmail = async (referralData) => {
  try {
    // Email to the referred friend
    const friendMailOptions = {
      from: process.env.EMAIL_USER,
      to: referralData.friendEmail,
      subject: `${referralData.yourName} has referred you to our ${referralData.program} program!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">You've Been Referred!</h2>
          <p>Hello ${referralData.friendName},</p>
          <p>Your friend <strong>${referralData.yourName}</strong> has referred you to our <strong>${referralData.program}</strong> program.</p>
          <p>We'd love to tell you more about this opportunity. One of our advisors will contact you soon to discuss how this program can benefit your career.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.WEBSITE_URL || 'https://example.com'}/programs/${encodeURIComponent(referralData.program)}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Learn More About The Program</a>
          </div>
          <p>If you have any immediate questions, feel free to contact us.</p>
          <p>Best regards,<br>The Education Team</p>
        </div>
      `
    };
    
    // Confirmation email to the referrer
    const referrerMailOptions = {
      from: process.env.EMAIL_USER,
      to: referralData.yourEmail,
      subject: 'Thank you for your referral!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Referral Received!</h2>
          <p>Hello ${referralData.yourName},</p>
          <p>Thank you for referring <strong>${referralData.friendName}</strong> to our <strong>${referralData.program}</strong> program.</p>
          <p>We've sent them an email and will be reaching out to them shortly. Once they enroll, you'll receive your referral reward!</p>
          <p>Thank you for spreading the word about our programs.</p>
          <p>Best regards,<br>The Education Team</p>
        </div>
      `
    };
    
    await transporter.sendMail(friendMailOptions);
    console.log(`Referral email sent to ${referralData.friendEmail}`);
    
    await transporter.sendMail(referrerMailOptions);
    console.log(`Confirmation email sent to ${referralData.yourEmail}`);
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Validation middleware
const validateReferralData = [
  body('yourName').trim().notEmpty().withMessage('Your name is required'),
  body('yourEmail').trim().isEmail().withMessage('Please enter a valid email address'),
  body('yourPhone').trim().matches(/^\d{10}$/).withMessage('Please enter a valid 10-digit phone number'),
  body('friendName').trim().notEmpty().withMessage('Friend\'s name is required'),
  body('friendEmail').trim().isEmail().withMessage('Please enter a valid email address'),
  body('friendPhone').trim().matches(/^\d{10}$/).withMessage('Please enter a valid 10-digit phone number'),
  body('program').trim().notEmpty().withMessage('Program selection is required')
];

// API endpoint to submit a new referral
app.post('/api/referrals', validateReferralData, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  try {
    // Save referral to database using Prisma
    const referral = await prisma.referral.create({
      data: {
        referrerName: req.body.yourName,
        referrerEmail: req.body.yourEmail,
        referrerPhone: req.body.yourPhone,
        friendName: req.body.friendName,
        friendEmail: req.body.friendEmail,
        friendPhone: req.body.friendPhone,
        program: req.body.program,
        status: 'PENDING'
      }
    });
    
    // Send notification emails
    await sendReferralEmail(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Referral submitted successfully',
      referralId: referral.id
    });
  } catch (error) {
    console.error('Error submitting referral:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your referral. Please try again later.'
    });
  }
});

// Get all referrals (for admin purposes)
app.get('/api/referrals', async (req, res) => {
  try {
    const referrals = await prisma.referral.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json({
      success: true,
      data: referrals
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching referrals.'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;