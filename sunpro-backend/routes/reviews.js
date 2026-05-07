const express = require('express');
const router = express.Router();
const Review = require('../models/Review');

router.post('/submit', async (req, res) => {
  try {
    console.log('⭐ New review received:', req.body);
    
    const review = new Review({
      name: req.body.name,
      city: req.body.city || 'India',
      service: req.body.service,
      rating: req.body.rating,
      review: req.body.review,
      notes: req.body.notes || ''
    });

    await review.save();
    console.log('✅ Review saved to database');
    
    res.json({
      success: true,
      message: 'Thank you for your review!'
    });
  } catch (error) {
    console.error('❌ Error saving review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review.'
    });
  }
});

router.get('/all', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;