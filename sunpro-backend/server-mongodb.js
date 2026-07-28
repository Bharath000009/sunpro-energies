require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ============ MONGODB CONNECTION ============
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected:', conn.connection.host);
        console.log('📊 Database:', conn.connection.name);
        return true;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        return false;
    }
};

// ============ MONGOOSE SCHEMAS ============
const quoteSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    serviceType: { 
        type: String, 
        required: true,
        enum: ['Residential Solar', 'Commercial Solar', 'Industrial Solar']
    },
    systemCapacity: { type: String, default: 'Not specified' },
    message: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['new', 'contacted', 'scheduled', 'completed', 'cancelled'],
        default: 'new'
    },
    ipAddress: String,
    userAgent: String
}, { 
    timestamps: true 
});

const reviewSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    city: { type: String, default: 'India', trim: true },
    service: { 
        type: String, 
        required: true,
        enum: ['Residential Solar', 'Commercial Solar', 'Industrial Solar']
    },
    rating: { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 5 
    },
    review: { type: String, required: true },
    notes: { type: String, default: '' },
    initials: { type: String },
    isApproved: { type: Boolean, default: true },
    ipAddress: String
}, { 
    timestamps: true 
});

// Generate initials before saving
reviewSchema.pre('save', function(next) {
    if (this.name) {
        const words = this.name.split(' ');
        this.initials = words.map(w => w[0]).join('').toUpperCase().substring(0, 2);
    }
    next();
});

const Quote = mongoose.model('Quote', quoteSchema);
const Review = mongoose.model('Review', reviewSchema);

// ============ QUOTES API ============
app.post('/api/quotes/submit', async (req, res) => {
    try {
        const { name, phone, city, serviceType, systemCapacity, message } = req.body;
        
        // Validation
        if (!name || !phone || !city || !serviceType) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please fill all required fields' 
            });
        }

        // Validate phone number
        const cleanPhone = phone.replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number'
            });
        }

        // Check for duplicate in last 24 hours
        const recentQuote = await Quote.findOne({
            phone: cleanPhone,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (recentQuote) {
            return res.json({
                success: true,
                message: 'We already have your enquiry! Our team will contact you soon.',
                existingEnquiry: true
            });
        }

        // Save to MongoDB
        const quote = new Quote({
            name,
            phone: cleanPhone,
            city,
            serviceType,
            systemCapacity: systemCapacity || 'Not specified',
            message: message || '',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        await quote.save();

        console.log('✅ Quote saved to MongoDB:', { name, phone: cleanPhone, serviceType, city });
        
        res.status(201).json({
            success: true,
            message: 'Thank you! Our solar expert will contact you within 24 hours.',
            data: { id: quote._id, name: quote.name }
        });

    } catch (error) {
        console.error('❌ Error saving quote:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit. Please try again or call us at 9381241664.' 
        });
    }
});

app.get('/api/quotes/all', async (req, res) => {
    try {
        const quotes = await Quote.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .select('-__v');
        
        console.log(`📋 Fetched ${quotes.length} quotes from MongoDB`);
        
        res.json({ 
            success: true, 
            count: quotes.length, 
            data: quotes 
        });
    } catch (error) {
        console.error('❌ Error fetching quotes:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching quotes' 
        });
    }
});

// Update quote status
app.patch('/api/quotes/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const quote = await Quote.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        
        if (!quote) {
            return res.status(404).json({ success: false, message: 'Quote not found' });
        }
        
        res.json({ success: true, data: quote });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating quote' });
    }
});

// ============ REVIEWS API ============
app.post('/api/reviews/submit', async (req, res) => {
    try {
        const { name, city, service, rating, review, notes } = req.body;
        
        // Validation
        if (!name || !rating || !review) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please fill all required fields (name, rating, review)' 
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                message: 'Rating must be between 1 and 5' 
            });
        }

        // Save to MongoDB
        const newReview = new Review({
            name,
            city: city || 'India',
            service: service || 'Residential Solar',
            rating: parseInt(rating),
            review,
            notes: notes || '',
            ipAddress: req.ip
        });

        await newReview.save();

        console.log('✅ Review saved to MongoDB:', { name, rating, service });
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your review! It will be published shortly.',
            data: newReview
        });

    } catch (error) {
        console.error('❌ Error saving review:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit review. Please try again.' 
        });
    }
});

app.get('/api/reviews/all', async (req, res) => {
    try {
        const reviews = await Review.find({ isApproved: true })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('-__v -ipAddress');
        
        console.log(`⭐ Fetched ${reviews.length} reviews from MongoDB`);
        
        res.json({ 
            success: true, 
            count: reviews.length, 
            data: reviews 
        });
    } catch (error) {
        console.error('❌ Error fetching reviews:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching reviews' 
        });
    }
});

// ============ STATS API ============
app.get('/api/stats', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalQuotes, todayQuotes, totalReviews, avgRatingResult] = await Promise.all([
            Quote.countDocuments(),
            Quote.countDocuments({ createdAt: { $gte: today } }),
            Review.countDocuments({ isApproved: true }),
            Review.aggregate([
                { $match: { isApproved: true } },
                { $group: { _id: null, avg: { $avg: '$rating' } } }
            ])
        ]);

        const averageRating = avgRatingResult.length > 0 
            ? avgRatingResult[0].avg.toFixed(1) 
            : '0';

        const lastQuote = await Quote.findOne()
            .sort({ createdAt: -1 })
            .select('createdAt');

        // Get service distribution
        const serviceDistribution = await Quote.aggregate([
            { $group: { _id: '$serviceType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const stats = {
            totalQuotes,
            todayQuotes,
            totalReviews: totalReviews,
            averageRating,
            lastQuoteDate: lastQuote ? lastQuote.createdAt : null,
            serviceDistribution
        };

        console.log('📊 Stats fetched from MongoDB:', {
            totalQuotes,
            todayQuotes,
            totalReviews,
            averageRating
        });
        
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error getting statistics' 
        });
    }
});

// ============ UTILITY ENDPOINTS ============
app.get('/api/test', async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
        status: 'ok', 
        message: 'SunPro Energies Backend is running! 🚀',
        time: new Date().toISOString(),
        storage: 'MongoDB',
        database: dbStatus,
        mongodb: true
    });
});

app.get('/api/health', async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
    res.json({
        status: dbStatus,
        uptime: process.uptime(),
        database: {
            status: dbStatus,
            host: mongoose.connection.host || 'not connected',
            name: mongoose.connection.name || 'not connected'
        },
        timestamp: new Date().toISOString()
    });
});

// Import data from JSON files to MongoDB
app.post('/api/migrate', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const DATA_DIR = path.join(__dirname, 'data');

        let quotesMigrated = 0;
        let reviewsMigrated = 0;

        // Migrate quotes
        if (fs.existsSync(path.join(DATA_DIR, 'quotes.json'))) {
            const quotes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'quotes.json'), 'utf8'));
            for (const quote of quotes) {
                const exists = await Quote.findOne({ phone: quote.phone, createdAt: quote.createdAt });
                if (!exists) {
                    await Quote.create({
                        name: quote.name,
                        phone: quote.phone,
                        city: quote.city,
                        serviceType: quote.serviceType,
                        systemCapacity: quote.systemCapacity || 'Not specified',
                        message: quote.message || '',
                        status: quote.status || 'new',
                        createdAt: quote.createdAt
                    });
                    quotesMigrated++;
                }
            }
        }

        // Migrate reviews
        if (fs.existsSync(path.join(DATA_DIR, 'reviews.json'))) {
            const reviews = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'reviews.json'), 'utf8'));
            for (const review of reviews) {
                const exists = await Review.findOne({ 
                    name: review.name, 
                    createdAt: review.createdAt 
                });
                if (!exists) {
                    await Review.create({
                        name: review.name,
                        city: review.city || 'India',
                        service: review.service,
                        rating: review.rating,
                        review: review.review,
                        notes: review.notes || '',
                        createdAt: review.createdAt
                    });
                    reviewsMigrated++;
                }
            }
        }

        res.json({
            success: true,
            message: 'Data migration completed',
            data: { quotesMigrated, reviewsMigrated }
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============ ADMIN AUTH ============
const JWT_SECRET = process.env.JWT_SECRET || 'SunPro@2024Secure!';
const ADMIN_USER = process.env.ADMIN_USER || 'sunpro_admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'SunPro@2024';

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        const token = jwt.sign(
            { admin: true, username: username }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        console.log('✅ Admin login successful');
        res.json({ success: true, token: token });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Protected Dashboard
app.get('/dashboard', (req, res) => {
    const token = req.query.token;
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            res.sendFile(path.join(__dirname, 'dashboard.html'));
            return;
        } catch (error) {
            res.redirect('/admin-login');
            return;
        }
    }
    res.redirect('/admin-login');
});

// Login Page
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
// SEO Routes
app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'robots.txt'));
});


// ============ FRONTEND ROUTES ============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});
// ============ ERROR HANDLERS ============
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `Route ${req.originalUrl} not found` 
    });
});

app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Connect to MongoDB first
    const isConnected = await connectDB();
    
    if (!isConnected) {
        console.log('\n⚠️  WARNING: MongoDB connection failed!');
        console.log('Server will start but database features won\'t work.');
        console.log('Check your MONGODB_URI in .env file\n');
    }

    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(60));
        console.log('   ☀️  SUNPRO ENERGIES - Production Server');
        console.log('='.repeat(60));
        console.log(`   🌐 Website:   http://localhost:${PORT}`);
        console.log(`   📊 Dashboard: http://localhost:${PORT}/dashboard`);
        console.log(`   📡 API:       http://localhost:${PORT}/api`);
        console.log(`   🗄️  Database:  ${isConnected ? 'MongoDB ✅' : 'MongoDB ❌'}`);
        console.log('='.repeat(60));
        console.log('   API Endpoints:');
        console.log('   POST /api/quotes/submit');
        console.log('   GET  /api/quotes/all');
        console.log('   POST /api/reviews/submit');
        console.log('   GET  /api/reviews/all');
        console.log('   GET  /api/stats');
        console.log('   GET  /api/health');
        console.log('   POST /api/migrate  (migrate JSON → MongoDB)');
        console.log('='.repeat(60) + '\n');
    });
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});