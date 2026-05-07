require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB Schemas (same as in server-mongodb.js)
const quoteSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true },
    serviceType: { type: String, required: true },
    systemCapacity: { type: String, default: 'Not specified' },
    message: { type: String, default: '' },
    status: { type: String, default: 'new' },
    createdAt: { type: Date }
}, { timestamps: false });

const reviewSchema = new mongoose.Schema({
    name: { type: String, required: true },
    city: { type: String, default: 'India' },
    service: { type: String, required: true },
    rating: { type: Number, required: true },
    review: { type: String, required: true },
    notes: { type: String, default: '' },
    initials: { type: String },
    isApproved: { type: Boolean, default: true },
    createdAt: { type: Date }
}, { timestamps: false });

// Generate initials
reviewSchema.pre('save', function(next) {
    if (this.name) {
        const words = this.name.split(' ');
        this.initials = words.map(w => w[0]).join('').toUpperCase().substring(0, 2);
    }
    next();
});

const Quote = mongoose.model('Quote', quoteSchema);
const Review = mongoose.model('Review', reviewSchema);

async function migrateData() {
    try {
        console.log('🔍 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const DATA_DIR = path.join(__dirname, 'data');
        let quotesMigrated = 0;
        let reviewsMigrated = 0;
        let quotesSkipped = 0;
        let reviewsSkipped = 0;

        // Migrate Quotes
        const quotesPath = path.join(DATA_DIR, 'quotes.json');
        if (fs.existsSync(quotesPath)) {
            const quotes = JSON.parse(fs.readFileSync(quotesPath, 'utf8'));
            console.log(`📋 Found ${quotes.length} quotes to migrate\n`);
            
            for (const quote of quotes) {
                try {
                    // Check if already exists
                    const exists = await Quote.findOne({ 
                        phone: quote.phone,
                        createdAt: new Date(quote.createdAt)
                    });

                    if (exists) {
                        console.log(`⏭️  Skipped (already exists): ${quote.name} - ${quote.phone}`);
                        quotesSkipped++;
                        continue;
                    }

                    // Create new quote
                    await Quote.create({
                        name: quote.name,
                        phone: quote.phone,
                        city: quote.city,
                        serviceType: quote.serviceType || 'Residential Solar',
                        systemCapacity: quote.systemCapacity || 'Not specified',
                        message: quote.message || '',
                        status: quote.status || 'new',
                        createdAt: new Date(quote.createdAt)
                    });

                    console.log(`✅ Migrated quote: ${quote.name} - ${quote.phone}`);
                    quotesMigrated++;
                } catch (error) {
                    console.error(`❌ Error migrating quote ${quote.name}:`, error.message);
                }
            }
        } else {
            console.log('📋 No quotes.json file found');
        }

        console.log('');

        // Migrate Reviews
        const reviewsPath = path.join(DATA_DIR, 'reviews.json');
        if (fs.existsSync(reviewsPath)) {
            const reviews = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
            console.log(`⭐ Found ${reviews.length} reviews to migrate\n`);
            
            for (const review of reviews) {
                try {
                    // Check if already exists
                    const exists = await Review.findOne({ 
                        name: review.name,
                        createdAt: new Date(review.createdAt)
                    });

                    if (exists) {
                        console.log(`⏭️  Skipped (already exists): ${review.name} - ${review.rating}⭐`);
                        reviewsSkipped++;
                        continue;
                    }

                    // Generate initials
                    const words = review.name.split(' ');
                    const initials = words.map(w => w[0]).join('').toUpperCase().substring(0, 2);

                    // Create new review
                    await Review.create({
                        name: review.name,
                        city: review.city || 'India',
                        service: review.service || 'Residential Solar',
                        rating: parseInt(review.rating) || 5,
                        review: review.review,
                        notes: review.notes || '',
                        initials: initials,
                        isApproved: review.isApproved !== false,
                        createdAt: new Date(review.createdAt)
                    });

                    console.log(`✅ Migrated review: ${review.name} - ${review.rating}⭐`);
                    reviewsMigrated++;
                } catch (error) {
                    console.error(`❌ Error migrating review ${review.name}:`, error.message);
                }
            }
        } else {
            console.log('⭐ No reviews.json file found');
        }

        console.log('\n' + '='.repeat(60));
        console.log('   📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`   ✅ Quotes migrated:  ${quotesMigrated}`);
        console.log(`   ⏭️  Quotes skipped:   ${quotesSkipped}`);
        console.log(`   ✅ Reviews migrated: ${reviewsMigrated}`);
        console.log(`   ⏭️  Reviews skipped:  ${reviewsSkipped}`);
        console.log('='.repeat(60));
        console.log('   🎉 Migration completed!\n');

        // Show current MongoDB counts
        const totalQuotes = await Quote.countDocuments();
        const totalReviews = await Review.countDocuments();
        
        console.log('   Current MongoDB Data:');
        console.log(`   📋 Total Quotes:  ${totalQuotes}`);
        console.log(`   ⭐ Total Reviews: ${totalReviews}\n`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Database connection closed');
        process.exit(0);
    }
}

// Run migration
migrateData();