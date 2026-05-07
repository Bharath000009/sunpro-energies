const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  serviceType: { type: String, required: true },
  systemCapacity: { type: String, default: 'Not specified' },
  message: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);