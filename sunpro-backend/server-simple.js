const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize empty files if they don't exist
if (!fs.existsSync(path.join(DATA_DIR, 'quotes.json'))) {
    fs.writeFileSync(path.join(DATA_DIR, 'quotes.json'), '[]');
}
if (!fs.existsSync(path.join(DATA_DIR, 'reviews.json'))) {
    fs.writeFileSync(path.join(DATA_DIR, 'reviews.json'), '[]');
}

// Helper functions
function readJSON(filename) {
    try {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

function writeJSON(filename, data) {
    try {
        fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error writing ${filename}:`, error.message);
    }
}

// ============ QUOTES API ============
// Submit a new quote
app.post('/api/quotes/submit', (req, res) => {
    try {
        const { name, phone, city, serviceType, systemCapacity, message } = req.body;
        
        // Validation
        if (!name || !phone || !city || !serviceType) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please fill all required fields' 
            });
        }

        // Check for duplicate phone numbers in last 24 hours
        const quotes = readJSON('quotes.json');
        const recentDuplicate = quotes.find(q => 
            q.phone === phone && 
            new Date() - new Date(q.createdAt) < 24 * 60 * 60 * 1000
        );

        if (recentDuplicate) {
            return res.json({
                success: true,
                message: 'We already have your enquiry! Our team will contact you soon.',
                existingEnquiry: true
            });
        }

        // Save quote
        const newQuote = {
            id: Date.now().toString(),
            name,
            phone,
            city,
            serviceType,
            systemCapacity: systemCapacity || 'Not specified',
            message: message || '',
            status: 'new',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        quotes.push(newQuote);
        writeJSON('quotes.json', quotes);

        console.log('✅ Quote saved:', { name, phone, serviceType, city });
        
        res.status(201).json({
            success: true,
            message: 'Thank you! Our solar expert will contact you within 24 hours.',
            data: { id: newQuote.id, name: newQuote.name }
        });

    } catch (error) {
        console.error('❌ Error saving quote:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit. Please try again.' 
        });
    }
});

// Get all quotes
app.get('/api/quotes/all', (req, res) => {
    try {
        const quotes = readJSON('quotes.json');
        // Sort by newest first
        quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`📋 Returning ${quotes.length} quotes`);
        
        res.json({ 
            success: true, 
            count: quotes.length, 
            data: quotes 
        });
    } catch (error) {
        console.error('❌ Error reading quotes:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error reading quotes' 
        });
    }
});

// ============ REVIEWS API ============
// Submit a new review
app.post('/api/reviews/submit', (req, res) => {
    try {
        const { name, city, service, rating, review, notes } = req.body;
        
        // Validation
        if (!name || !rating || !review) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please fill all required fields' 
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                message: 'Rating must be between 1 and 5' 
            });
        }

        const reviews = readJSON('reviews.json');
        
        // Generate initials
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
        
        const newReview = {
            id: Date.now().toString(),
            name,
            city: city || 'India',
            service: service || 'Residential Solar',
            rating: parseInt(rating),
            review,
            notes: notes || '',
            initials,
            isApproved: true,
            createdAt: new Date().toISOString()
        };

        reviews.push(newReview);
        writeJSON('reviews.json', reviews);

        console.log('✅ Review saved:', { name, rating, service });
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your review! It will appear shortly.',
            data: newReview
        });

    } catch (error) {
        console.error('❌ Error saving review:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit review.' 
        });
    }
});

// Get all reviews
app.get('/api/reviews/all', (req, res) => {
    try {
        const reviews = readJSON('reviews.json');
        // Filter approved and sort by newest
        const approvedReviews = reviews
            .filter(r => r.isApproved !== false)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`⭐ Returning ${approvedReviews.length} reviews`);
        
        res.json({ 
            success: true, 
            count: approvedReviews.length, 
            data: approvedReviews 
        });
    } catch (error) {
        console.error('❌ Error reading reviews:', error);
        res.json({ 
            success: true, 
            data: [] 
        });
    }
});

// ============ STATS API ============
app.get('/api/stats', (req, res) => {
    try {
        const quotes = readJSON('quotes.json');
        const reviews = readJSON('reviews.json');
        
        const today = new Date();
        const todayQuotes = quotes.filter(q => {
            const quoteDate = new Date(q.createdAt);
            return quoteDate.toDateString() === today.toDateString();
        });

        const approvedReviews = reviews.filter(r => r.isApproved !== false);
        const averageRating = approvedReviews.length > 0 
            ? (approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length).toFixed(1)
            : 0;

        const stats = {
            totalQuotes: quotes.length,
            todayQuotes: todayQuotes.length,
            totalReviews: approvedReviews.length,
            averageRating: averageRating,
            lastQuoteDate: quotes.length > 0 ? quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt : null
        };

        console.log('📊 Stats:', stats);
        
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.json({ 
            success: false, 
            message: 'Error getting stats' 
        });
    }
});

// ============ TEST API ============
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'SunPro Energies Backend is running! 🚀',
        time: new Date().toISOString(),
        storage: 'File System (JSON)',
        mongodb: false
    });
});

// Health check
app.get('/api/health', (req, res) => {
    const quotes = readJSON('quotes.json');
    const reviews = readJSON('reviews.json');
    
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        storage: {
            quotes: quotes.length,
            reviews: reviews.length
        },
        timestamp: new Date().toISOString()
    });
});

// ============ FRONTEND ROUTES ============
// Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Main website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ============ 404 HANDLER ============
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `Route ${req.originalUrl} not found` 
    });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('   ☀️  SUNPRO ENERGIES - Backend Server');
    console.log('='.repeat(60));
    console.log(`   🌐 Website:   http://localhost:${PORT}`);
    console.log(`   📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`   📡 API Base:  http://localhost:${PORT}/api`);
    console.log(`   🧪 Test:      http://localhost:${PORT}/api/test`);
    console.log(`   💾 Storage:   File System (JSON files)`);
    console.log('='.repeat(60));
    console.log('   Available API Endpoints:');
    console.log(`   POST /api/quotes/submit  - Submit a quote`);
    console.log(`   GET  /api/quotes/all     - Get all quotes`);
    console.log(`   POST /api/reviews/submit - Submit a review`);
    console.log(`   GET  /api/reviews/all    - Get all reviews`);
    console.log(`   GET  /api/stats          - Get statistics`);
    console.log(`   GET  /api/test           - Test endpoint`);
    console.log(`   GET  /api/health         - Health check`);
    console.log('='.repeat(60));
    console.log('   ✅ Server is ready to accept requests!\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 SIGTERM received. Shutting down...');
    process.exit(0);
});