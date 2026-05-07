const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');

router.post('/submit', async (req, res) => {
  try {
    console.log('📝 New quote received:', req.body);
    
    const quote = new Quote({
      name: req.body.name,
      phone: req.body.phone,
      city: req.body.city,
      serviceType: req.body.serviceType,
      systemCapacity: req.body.systemCapacity || 'Not specified',
      message: req.body.message || ''
    });

    await quote.save();
    console.log('✅ Quote saved to database');
    
    res.json({
      success: true,
      message: 'Thank you! Our team will contact you soon.'
    });
  } catch (error) {
    console.error('❌ Error saving quote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit. Please try again.'
    });
  }
});

router.get('/all', async (req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;