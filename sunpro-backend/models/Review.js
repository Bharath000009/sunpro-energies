const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String, default: 'India' },
  service: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String, required: true },
  notes: { type: String, default: '' },
  initials: { type: String }
}, { timestamps: true });

reviewSchema.pre('save', function(next) {
  if (this.name) {
    const words = this.name.split(' ');
    this.initials = words.map(w => w[0]).join('').toUpperCase().substring(0, 2);
  }
  next();
});

module.exports = mongoose.model('Review', reviewSchema);